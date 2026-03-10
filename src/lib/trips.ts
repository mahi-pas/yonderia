import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ItineraryItem, InviteCodeType, Profile, Trip, TripParticipant } from "@/lib/types";

export type TripPageParticipant = {
  avatarUrl: string | null;
  name: string;
  profilePath: string | null;
  role: TripParticipant["role"];
};

export type TripPageTrip = Pick<
  Trip,
  "description" | "end_date" | "id" | "image_url" | "location_name" | "name" | "start_date"
>;

export type TripPageItineraryItem = Pick<
  ItineraryItem,
  | "day_date"
  | "description"
  | "destination_latitude"
  | "destination_longitude"
  | "destination_name"
  | "end_time"
  | "id"
  | "image_url"
  | "item_type"
  | "latitude"
  | "location_name"
  | "longitude"
  | "sort_order"
  | "start_time"
  | "title"
>;

export type TripPageData = {
  itineraryItems: TripPageItineraryItem[];
  participants: TripPageParticipant[];
  trip: TripPageTrip;
};

export type InviteCodeLookup = {
  codeType: InviteCodeType;
  tripId: string;
};

type TripParticipantListRow = Pick<TripParticipant, "nickname" | "role" | "trip_id" | "user_id">;
type ProfileRow = Pick<Profile, "avatar_url" | "display_name" | "id">;
type InviteCodeRow = {
  code_type: InviteCodeType;
  trip_id: string;
};

function compareParticipants(
  left: Pick<TripParticipant, "role" | "user_id"> & { display_name: string | null; nickname: string | null },
  right: Pick<TripParticipant, "role" | "user_id"> & {
    display_name: string | null;
    nickname: string | null;
  },
): number {
  const roleRank = {
    organizer: 0,
    planner: 1,
    member: 2,
  } as const;

  const roleDifference = roleRank[left.role] - roleRank[right.role];

  if (roleDifference !== 0) {
    return roleDifference;
  }

  const leftLabel = left.nickname || left.display_name || left.user_id;
  const rightLabel = right.nickname || right.display_name || right.user_id;
  return leftLabel.localeCompare(rightLabel);
}

export async function getParticipantMembership(
  supabase: SupabaseClient<Database>,
  tripId: string,
  userId: string,
): Promise<Pick<TripParticipant, "id" | "role" | "trip_id" | "user_id"> | null> {
  const { data, error } = await supabase
    .from("trip_participants")
    .select("id, trip_id, user_id, role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Pick<TripParticipant, "id" | "role" | "trip_id" | "user_id"> | null) ?? null;
}

export async function getInviteCodeLookup(
  supabase: SupabaseClient<Database>,
  tripId: string,
  code: string,
): Promise<InviteCodeLookup | null> {
  const { data, error } = await supabase
    .from("invite_codes")
    .select("trip_id, code_type")
    .eq("trip_id", tripId)
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const inviteCode = data as InviteCodeRow | null;

  if (!inviteCode) {
    return null;
  }

  return {
    codeType: inviteCode.code_type,
    tripId: inviteCode.trip_id,
  };
}

export async function getTripPageData(
  supabase: SupabaseClient<Database>,
  tripId: string,
  options?: {
    includeProfilePaths?: boolean;
  },
): Promise<TripPageData | null> {
  const includeProfilePaths = options?.includeProfilePaths ?? false;

  const [
    { data: tripData, error: tripError },
    { data: participantData, error: participantError },
    { data: itineraryData, error: itineraryError },
  ] = await Promise.all([
    supabase
      .from("trips")
      .select("id, name, description, image_url, location_name, start_date, end_date")
      .eq("id", tripId)
      .maybeSingle(),
    supabase
      .from("trip_participants")
      .select("trip_id, user_id, nickname, role")
      .eq("trip_id", tripId),
    supabase
      .from("itinerary_items")
      .select(
        "id, item_type, title, description, image_url, day_date, start_time, end_time, location_name, latitude, longitude, destination_name, destination_latitude, destination_longitude, sort_order",
      )
      .eq("trip_id", tripId)
      .order("day_date", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  if (tripError) {
    throw new Error(tripError.message);
  }

  if (participantError) {
    throw new Error(participantError.message);
  }

  if (itineraryError) {
    throw new Error(itineraryError.message);
  }

  if (!tripData) {
    return null;
  }

  const participantRows = (participantData ?? []) as TripParticipantListRow[];
  const itineraryItems = (itineraryData ?? []) as TripPageItineraryItem[];
  const participantUserIds = [...new Set(participantRows.map((row) => row.user_id))];

  const { data: profileData, error: profileError } =
    participantUserIds.length === 0
      ? { data: [] as ProfileRow[], error: null }
      : await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", participantUserIds);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profiles = (profileData ?? []) as ProfileRow[];
  const profileMap = new Map<string, ProfileRow>();

  for (const profile of profiles) {
    profileMap.set(profile.id, profile);
  }

  const participants = participantRows
    .map((participant) => {
      const profile = profileMap.get(participant.user_id);
      const name = participant.nickname || profile?.display_name || "Traveler";

      return {
        avatarUrl: profile?.avatar_url ?? null,
        display_name: profile?.display_name ?? null,
        name,
        nickname: participant.nickname,
        profilePath: includeProfilePaths ? `/profile/${participant.user_id}` : null,
        role: participant.role,
        user_id: participant.user_id,
      };
    })
    .sort(compareParticipants)
    .map((participant) => ({
      avatarUrl: participant.avatarUrl,
      name: participant.name,
      profilePath: participant.profilePath,
      role: participant.role,
    }));

  return {
    itineraryItems,
    participants,
    trip: tripData as TripPageTrip,
  };
}
