import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  EventComment,
  EventCommentReaction,
  EventRsvp,
  ItineraryItem,
  NotificationRead,
  Profile,
  Trip,
  TripParticipant,
} from "@/lib/types";

export type NotificationKind =
  | "announcement"
  | "comment-reactions"
  | "event-comment"
  | "new-event"
  | "trip-comment";

export type UserNotification = {
  actor: {
    avatarUrl: string | null;
    name: string;
    userId: string;
  } | null;
  createdAt: string;
  description: string;
  href: string;
  id: string;
  isRead: boolean;
  kind: NotificationKind;
  title: string;
  tripId: string;
  tripName: string;
};

type MembershipRow = Pick<TripParticipant, "joined_at" | "trip_id">;
type TripRow = Pick<Trip, "id" | "name">;
type ItineraryItemRow = Pick<ItineraryItem, "created_at" | "created_by" | "id" | "item_type" | "title" | "trip_id">;
type EventCommentRow = Pick<
  EventComment,
  "content" | "created_at" | "gif_url" | "id" | "is_announcement" | "itinerary_item_id" | "trip_id" | "user_id"
>;
type OwnEventCommentRow = Pick<
  EventComment,
  "content" | "created_at" | "gif_url" | "id" | "itinerary_item_id" | "trip_id"
>;
type ReactionRow = Pick<EventCommentReaction, "comment_id" | "created_at" | "emoji" | "user_id">;
type EventRsvpRow = Pick<EventRsvp, "itinerary_item_id" | "status" | "updated_at">;
type ProfileRow = Pick<Profile, "avatar_url" | "display_name" | "id">;
type NotificationReadRow = Pick<NotificationRead, "notification_id">;

/**
 * True when `notification_reads` is missing (migration not applied) or PostgREST schema cache is stale.
 * In that case we treat all notifications as unread and skip persisting read state.
 */
export function isNotificationReadsTableUnavailable(error: { message?: string } | null | undefined): boolean {
  const msg = error?.message?.toLowerCase() ?? "";
  if (!msg.includes("notification_reads")) {
    return false;
  }
  return (
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

function getItemLabel(itemType: ItineraryItem["item_type"]): string {
  if (itemType === "hotel") {
    return "hotel stay";
  }

  if (itemType === "commute") {
    return "commute";
  }

  return "event";
}

function trimNotificationText(value: string | null, fallback: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function buildCompressedReactionDescription(
  reactorNames: string[],
  itemTitle: string,
  uniqueEmojis: string[],
): string {
  const emojiClause = uniqueEmojis.length === 1 ? ` with ${uniqueEmojis[0]}` : "";
  const target = `your comment on ${itemTitle}`;
  const n = reactorNames.length;

  if (n === 1) {
    return `${reactorNames[0]} reacted${emojiClause} to ${target}.`;
  }

  if (n === 2) {
    return `${reactorNames[0]} and ${reactorNames[1]} reacted${emojiClause} to ${target}.`;
  }

  if (n === 3) {
    return `${reactorNames[0]}, ${reactorNames[1]}, and ${reactorNames[2]} reacted${emojiClause} to ${target}.`;
  }

  return `${reactorNames[0]}, ${reactorNames[1]}, and ${n - 2} others reacted${emojiClause} to ${target}.`;
}

function getActor(profileMap: Map<string, ProfileRow>, userId: string | null): UserNotification["actor"] {
  if (!userId) {
    return null;
  }

  const profile = profileMap.get(userId);
  return {
    avatarUrl: profile?.avatar_url ?? null,
    name: profile?.display_name?.trim() || "Someone",
    userId,
  };
}

function getEarlierDate(left: string | undefined, right: string): string {
  if (!left) {
    return right;
  }

  return left < right ? left : right;
}

function toReadId(kind: NotificationKind, sourceId: string): string {
  return `${kind}:${sourceId}`;
}

/** Deep-link into itinerary / comments / event detail (handled by ItineraryWithComments). */
function tripNotificationHref(tripId: string, query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return `/trip/${tripId}?${params.toString()}`;
}

export function buildNotificationReadRows(userId: string, notificationIds: string[]) {
  return [...new Set(notificationIds)].map((notificationId) => ({
    notification_id: notificationId,
    user_id: userId,
  })) as Database["public"]["Tables"]["notification_reads"]["Insert"][];
}

export function getUnreadNotificationCount(notifications: UserNotification[]): number {
  return notifications.reduce((count, notification) => count + (notification.isRead ? 0 : 1), 0);
}

export async function getNotificationsForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserNotification[]> {
  const { data: membershipsData, error: membershipsError } = await supabase
    .from("trip_participants")
    .select("trip_id, joined_at")
    .eq("user_id", userId);

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const memberships = (membershipsData ?? []) as MembershipRow[];
  const tripIds = [...new Set(memberships.map((membership) => membership.trip_id))];

  if (tripIds.length === 0) {
    return [];
  }

  const membershipByTrip = new Map<string, MembershipRow>();
  for (const membership of memberships) {
    membershipByTrip.set(membership.trip_id, membership);
  }

  const [
    { data: tripsData, error: tripsError },
    { data: itineraryItemsData, error: itineraryItemsError },
    { data: commentsData, error: commentsError },
    { data: rsvpsData, error: rsvpsError },
    { data: ownCommentsData, error: ownCommentsError },
    { data: readsData, error: readsError },
  ] = await Promise.all([
    supabase.from("trips").select("id, name").in("id", tripIds),
    supabase.from("itinerary_items").select("id, trip_id, item_type, title, created_at, created_by").in("trip_id", tripIds),
    supabase
      .from("event_comments")
      .select("id, trip_id, itinerary_item_id, user_id, content, gif_url, is_announcement, created_at")
      .in("trip_id", tripIds),
    supabase
      .from("event_rsvps")
      .select("itinerary_item_id, status, updated_at")
      .eq("user_id", userId)
      .eq("status", "going"),
    supabase
      .from("event_comments")
      .select("id, trip_id, itinerary_item_id, created_at, content, gif_url")
      .eq("user_id", userId)
      .in("trip_id", tripIds)
      .not("itinerary_item_id", "is", null),
    supabase.from("notification_reads").select("notification_id").eq("user_id", userId),
  ]);

  if (tripsError) {
    throw new Error(tripsError.message);
  }

  if (itineraryItemsError) {
    throw new Error(itineraryItemsError.message);
  }

  if (commentsError) {
    throw new Error(commentsError.message);
  }

  if (rsvpsError) {
    throw new Error(rsvpsError.message);
  }

  if (ownCommentsError) {
    throw new Error(ownCommentsError.message);
  }

  if (readsError && !isNotificationReadsTableUnavailable(readsError)) {
    throw new Error(readsError.message);
  }

  const trips = (tripsData ?? []) as TripRow[];
  const itineraryItems = (itineraryItemsData ?? []) as ItineraryItemRow[];
  const comments = (commentsData ?? []) as EventCommentRow[];
  const rsvps = (rsvpsData ?? []) as EventRsvpRow[];
  const ownComments = (ownCommentsData ?? []) as OwnEventCommentRow[];
  const reads =
    readsError && isNotificationReadsTableUnavailable(readsError)
      ? ([] as NotificationReadRow[])
      : ((readsData ?? []) as NotificationReadRow[]);

  const tripMap = new Map<string, TripRow>();
  for (const trip of trips) {
    tripMap.set(trip.id, trip);
  }

  const itineraryMap = new Map<string, ItineraryItemRow>();
  for (const item of itineraryItems) {
    itineraryMap.set(item.id, item);
  }

  const relevantSinceByItem = new Map<string, string>();

  for (const rsvp of rsvps) {
    relevantSinceByItem.set(
      rsvp.itinerary_item_id,
      getEarlierDate(relevantSinceByItem.get(rsvp.itinerary_item_id), rsvp.updated_at),
    );
  }

  for (const comment of ownComments) {
    if (!comment.itinerary_item_id) {
      continue;
    }

    relevantSinceByItem.set(
      comment.itinerary_item_id,
      getEarlierDate(relevantSinceByItem.get(comment.itinerary_item_id), comment.created_at),
    );
  }

  const myCommentIds = ownComments.map((comment) => comment.id);

  const { data: reactionsData, error: reactionsError } =
    myCommentIds.length === 0
      ? { data: [] as ReactionRow[], error: null }
      : await supabase
          .from("event_comment_reactions")
          .select("comment_id, user_id, emoji, created_at")
          .in("comment_id", myCommentIds)
          .neq("user_id", userId);

  if (reactionsError) {
    throw new Error(reactionsError.message);
  }

  const reactionRows = (reactionsData ?? []) as ReactionRow[];
  const reactorUserIds = [...new Set(reactionRows.map((row) => row.user_id))];

  const actorUserIds = [
    ...new Set([
      ...itineraryItems.map((item) => item.created_by).filter((value): value is string => Boolean(value)),
      ...comments.map((comment) => comment.user_id),
      ...reactorUserIds,
    ]),
  ];

  const { data: profilesData, error: profilesError } =
    actorUserIds.length === 0
      ? { data: [] as ProfileRow[], error: null }
      : await supabase.from("profiles").select("id, display_name, avatar_url").in("id", actorUserIds);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const profile of (profilesData ?? []) as ProfileRow[]) {
    profileMap.set(profile.id, profile);
  }

  const ownCommentById = new Map<string, OwnEventCommentRow>();
  for (const comment of ownComments) {
    ownCommentById.set(comment.id, comment);
  }

  const reactionsByCommentId = new Map<string, ReactionRow[]>();
  for (const row of reactionRows) {
    const list = reactionsByCommentId.get(row.comment_id) ?? [];
    list.push(row);
    reactionsByCommentId.set(row.comment_id, list);
  }

  const readIds = new Set(reads.map((read) => read.notification_id));
  const notifications: UserNotification[] = [];

  for (const item of itineraryItems) {
    const trip = tripMap.get(item.trip_id);
    const membership = membershipByTrip.get(item.trip_id);

    if (!trip || !membership || item.created_at <= membership.joined_at || item.created_by === userId) {
      continue;
    }

    const actor = getActor(profileMap, item.created_by);
    const title = `New ${getItemLabel(item.item_type)}`;

    notifications.push({
      actor,
      createdAt: item.created_at,
      description: `${actor?.name || "Someone"} added ${item.title} to ${trip.name}.`,
      href: tripNotificationHref(item.trip_id, { item: item.id, open: "1" }),
      id: toReadId("new-event", item.id),
      isRead: readIds.has(toReadId("new-event", item.id)),
      kind: "new-event",
      title,
      tripId: item.trip_id,
      tripName: trip.name,
    });
  }

  for (const comment of comments) {
    const trip = tripMap.get(comment.trip_id);
    const membership = membershipByTrip.get(comment.trip_id);

    if (!trip || !membership || comment.created_at <= membership.joined_at || comment.user_id === userId) {
      continue;
    }

    const actor = getActor(profileMap, comment.user_id);

    if (!comment.itinerary_item_id) {
      const kind: NotificationKind = comment.is_announcement ? "announcement" : "trip-comment";
      const title = comment.is_announcement ? "New announcement" : "New trip comment";
      const description = comment.is_announcement
        ? trimNotificationText(comment.content, `${actor?.name || "Someone"} posted an announcement in ${trip.name}.`)
        : trimNotificationText(comment.content, `${actor?.name || "Someone"} commented on ${trip.name}.`);
      const notificationId = toReadId(kind, comment.id);

      notifications.push({
        actor,
        createdAt: comment.created_at,
        description,
        href: tripNotificationHref(comment.trip_id, { tab: "comments", comment: comment.id }),
        id: notificationId,
        isRead: readIds.has(notificationId),
        kind,
        title,
        tripId: comment.trip_id,
        tripName: trip.name,
      });

      continue;
    }

    const relevantSince = relevantSinceByItem.get(comment.itinerary_item_id);
    const itineraryItem = itineraryMap.get(comment.itinerary_item_id);

    if (!relevantSince || !itineraryItem || comment.created_at <= relevantSince) {
      continue;
    }

    const notificationId = toReadId("event-comment", comment.id);
    const fallbackDescription = `${actor?.name || "Someone"} commented on ${itineraryItem.title}.`;

    notifications.push({
      actor,
      createdAt: comment.created_at,
      description: trimNotificationText(comment.content, fallbackDescription),
      href: tripNotificationHref(comment.trip_id, {
        detailComments: "1",
        item: comment.itinerary_item_id,
      }),
      id: notificationId,
      isRead: readIds.has(notificationId),
      kind: "event-comment",
      title: `New comment on ${itineraryItem.title}`,
      tripId: comment.trip_id,
      tripName: trip.name,
    });
  }

  for (const [commentId, rows] of reactionsByCommentId) {
    const comment = ownCommentById.get(commentId);
    if (!comment?.itinerary_item_id) {
      continue;
    }

    const trip = tripMap.get(comment.trip_id);
    const membership = membershipByTrip.get(comment.trip_id);
    if (!trip || !membership || comment.created_at <= membership.joined_at) {
      continue;
    }

    const itineraryItem = itineraryMap.get(comment.itinerary_item_id);
    const relevantSince = relevantSinceByItem.get(comment.itinerary_item_id);
    if (!itineraryItem || !relevantSince) {
      continue;
    }

    const eligible = rows.filter(
      (row) => row.created_at > membership.joined_at && row.created_at > relevantSince,
    );
    if (eligible.length === 0) {
      continue;
    }

    eligible.sort((left, right) => right.created_at.localeCompare(left.created_at));
    const seenReactors = new Set<string>();
    const reactorIdsOrdered: string[] = [];
    for (const row of eligible) {
      if (seenReactors.has(row.user_id)) {
        continue;
      }
      seenReactors.add(row.user_id);
      reactorIdsOrdered.push(row.user_id);
    }

    const seenEmojis = new Set<string>();
    const uniqueEmojis: string[] = [];
    for (const row of eligible) {
      if (seenEmojis.has(row.emoji)) {
        continue;
      }
      seenEmojis.add(row.emoji);
      uniqueEmojis.push(row.emoji);
    }

    const createdAt = eligible.reduce(
      (latest, row) => (row.created_at > latest ? row.created_at : latest),
      eligible[0].created_at,
    );

    const reactorNames = reactorIdsOrdered.map(
      (id) => profileMap.get(id)?.display_name?.trim() || "Someone",
    );
    const description = buildCompressedReactionDescription(
      reactorNames,
      itineraryItem.title,
      uniqueEmojis,
    );
    const primaryReactorId = reactorIdsOrdered[0];
    const actor = getActor(profileMap, primaryReactorId);
    const notificationId = toReadId("comment-reactions", comment.id);

    notifications.push({
      actor,
      createdAt,
      description,
      href: tripNotificationHref(comment.trip_id, {
        detailComments: "1",
        item: comment.itinerary_item_id,
      }),
      id: notificationId,
      isRead: readIds.has(notificationId),
      kind: "comment-reactions",
      title: `Reactions on ${itineraryItem.title}`,
      tripId: comment.trip_id,
      tripName: trip.name,
    });
  }

  notifications.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return notifications;
}
