"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventComment } from "@/lib/types";
import type { EventCommentWithAuthor } from "./useEventComments";

export type AllEventCommentRow = {
  comment: EventCommentWithAuthor;
  /** Event id, or null for trip-level comment/announcement */
  itineraryItemId: string | null;
};

type UseAllEventCommentsOptions = {
  enabled?: boolean;
  itineraryItemIds: string[];
  tripId: string | null;
};

export function useAllEventComments({
  enabled = true,
  itineraryItemIds,
  tripId,
}: UseAllEventCommentsOptions): {
  addAnnouncement: (content: string | null, gifUrl: string | null) => Promise<void>;
  addTripComment: (content: string | null, gifUrl: string | null) => Promise<void>;
  comments: AllEventCommentRow[];
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [comments, setComments] = useState<AllEventCommentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const itineraryItemIdsKey = useMemo(
    () => itineraryItemIds.join(","),
    [itineraryItemIds],
  );

  const fetchComments = useCallback(async () => {
    if (!tripId) {
      setComments([]);
      setError(null);
      return;
    }

    const supabase = createClient();
    const cols = "id, trip_id, itinerary_item_id, user_id, content, gif_url, is_announcement, created_at, updated_at";

    // Event comments (when we have items)
    const eventPromise =
      itineraryItemIds.length > 0
        ? supabase
            .from("event_comments")
            .select(cols)
            .in("itinerary_item_id", itineraryItemIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as never[], error: null });

    // Trip-level comments and announcements
    const tripPromise = supabase
      .from("event_comments")
      .select(cols)
      .eq("trip_id", tripId)
      .is("itinerary_item_id", null)
      .order("created_at", { ascending: true });

    const [eventResult, tripResult] = await Promise.all([eventPromise, tripPromise]);

    if (eventResult.error) {
      setError(eventResult.error.message);
      setComments([]);
      return;
    }
    if (tripResult.error) {
      setError(tripResult.error.message);
      setComments([]);
      return;
    }

    type CommentRow = Pick<
      EventComment,
      "id" | "trip_id" | "itinerary_item_id" | "user_id" | "content" | "gif_url" | "is_announcement" | "created_at" | "updated_at"
    >;
    const eventRows = (eventResult.data ?? []) as CommentRow[];
    const tripRows = (tripResult.data ?? []) as CommentRow[];
    const commentsRows = [...eventRows, ...tripRows];

    if (commentsRows.length === 0) {
      setComments([]);
      setError(null);
      return;
    }

    const { data: participantsData } = await supabase
      .from("trip_participants")
      .select("user_id, nickname")
      .eq("trip_id", tripId);

    type ParticipantRow = { user_id: string; nickname: string | null };
    const nicknameByUser = new Map<string, string | null>();
    for (const p of (participantsData ?? []) as ParticipantRow[]) {
      nicknameByUser.set(p.user_id, p.nickname ?? null);
    }

    const userIds = [...new Set(commentsRows.map((c) => c.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds);

    type ProfileRow = { id: string; display_name: string | null; avatar_url: string | null };
    const profileByUser = new Map(
      ((profilesData ?? []) as ProfileRow[]).map((p) => [
        p.id,
        { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null },
      ]),
    );

    const withAuthor: AllEventCommentRow[] = commentsRows.map((c) => {
      const profile = profileByUser.get(c.user_id);
      return {
        comment: {
          ...c,
          author: {
            display_name: profile?.display_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            nickname: nicknameByUser.get(c.user_id) ?? null,
          },
        } as EventCommentWithAuthor,
        itineraryItemId: c.itinerary_item_id,
      };
    });

    setComments(withAuthor);
    setError(null);
  }, [tripId, itineraryItemIds]);

  useEffect(() => {
    if (!enabled || !tripId) {
      queueMicrotask(() => {
        setComments([]);
        setError(null);
      });
      return;
    }

    queueMicrotask(() => void fetchComments());

    const supabase = createClient();
    let isMounted = true;
    const channel = supabase
      .channel(`event_comments:all:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_comments",
        },
        () => {
          if (isMounted) void fetchComments();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [enabled, tripId, itineraryItemIdsKey, itineraryItemIds.length, fetchComments]);

  const addTripComment = useCallback(
    async (content: string | null, gifUrl: string | null) => {
      if (!tripId || (!content && !gifUrl)) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error: insertError } = await supabase
        .from("event_comments")
        .insert({
          trip_id: tripId,
          itinerary_item_id: null,
          user_id: user.id,
          content: content || null,
          gif_url: gifUrl || null,
          is_announcement: false,
        } as never);

      if (insertError) {
        setError(insertError.message);
        throw insertError;
      }
      void fetchComments();
      setError(null);
    },
    [tripId, fetchComments],
  );

  const addAnnouncement = useCallback(
    async (content: string | null, gifUrl: string | null) => {
      if (!tripId || (!content?.trim() && !gifUrl)) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error: insertError } = await supabase
        .from("event_comments")
        .insert({
          trip_id: tripId,
          itinerary_item_id: null,
          user_id: user.id,
          content: content?.trim() || null,
          gif_url: gifUrl || null,
          is_announcement: true,
        } as never);

      if (insertError) {
        setError(insertError.message);
        throw insertError;
      }
      void fetchComments();
      setError(null);
    },
    [tripId, fetchComments],
  );

  return {
    addAnnouncement,
    addTripComment,
    comments,
    error,
    refetch: fetchComments,
  };
}
