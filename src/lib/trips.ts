import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ItineraryItem, InviteCodeType, Profile, Trip, TripParticipant } from "@/lib/types";

export type TripPageParticipant = {
  avatarUrl: string | null;
  name: string;
  profilePath: string | null;
  role: TripParticipant["role"];
};

export type ParticipantMembership = Pick<
  TripParticipant,
  | "arrival_location"
  | "arrival_time"
  | "departure_location"
  | "departure_time"
  | "id"
  | "nickname"
  | "role"
  | "trip_id"
  | "user_id"
>;

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

export type InvitePreview = {
  codeType: InviteCodeType;
  organizer: {
    avatarUrl: string | null;
    displayName: string | null;
  };
  trip: Pick<Trip, "end_date" | "image_url" | "location_name" | "name" | "start_date">;
  tripId: string;
};

type TripParticipantListRow = Pick<TripParticipant, "nickname" | "role" | "trip_id" | "user_id">;
type ProfileRow = Pick<Profile, "avatar_url" | "display_name" | "id">;
type InviteCodeRow = {
  code_type: InviteCodeType;
  trip_id: string;
};
type InvitePreviewTripRow = Pick<
  Trip,
  "created_by" | "end_date" | "image_url" | "location_name" | "name" | "start_date"
>;

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
): Promise<ParticipantMembership | null> {
  const { data, error } = await supabase
    .from("trip_participants")
    .select(
      "id, trip_id, user_id, role, nickname, arrival_time, arrival_location, departure_time, departure_location",
    )
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ParticipantMembership | null) ?? null;
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

export async function getInvitePreview(
  supabase: SupabaseClient<Database>,
  code: string,
): Promise<InvitePreview | null> {
  const { data: inviteCodeData, error: inviteCodeError } = await supabase
    .from("invite_codes")
    .select("trip_id, code_type")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (inviteCodeError) {
    throw new Error(inviteCodeError.message);
  }

  const inviteCode = inviteCodeData as InviteCodeRow | null;

  if (!inviteCode) {
    return null;
  }

  const { data: tripData, error: tripError } = await supabase
    .from("trips")
    .select("created_by, name, image_url, start_date, end_date, location_name")
    .eq("id", inviteCode.trip_id)
    .maybeSingle();

  if (tripError) {
    throw new Error(tripError.message);
  }

  const trip = tripData as InvitePreviewTripRow | null;

  if (!trip) {
    return null;
  }

  const { data: organizerData, error: organizerError } = trip.created_by
    ? await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", trip.created_by)
        .maybeSingle()
    : { data: null, error: null };

  if (organizerError) {
    throw new Error(organizerError.message);
  }

  const organizer = organizerData as ProfileRow | null;

  return {
    codeType: inviteCode.code_type,
    organizer: {
      avatarUrl: organizer?.avatar_url ?? null,
      displayName: organizer?.display_name ?? null,
    },
    trip: {
      end_date: trip.end_date,
      image_url: trip.image_url,
      location_name: trip.location_name,
      name: trip.name,
      start_date: trip.start_date,
    },
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
