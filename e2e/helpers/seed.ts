import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type {
  Database,
  InviteCode,
  InviteCodeType,
  ItineraryItem,
  ItineraryItemType,
  RsvpStatus,
  Trip,
  TripParticipant,
  TripParticipantRole,
} from "@/lib/types";

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function createServiceRoleClient() {
  return createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    getRequiredEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function getTripCreatorId(tripId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (error) {
    throw error;
  }

  const trip = data as Trip | null;

  if (!trip?.created_by) {
    throw new Error(`Trip ${tripId} does not have a creator.`);
  }

  return trip.created_by;
}

export async function createTestTrip(
  organizerId: string,
): Promise<{ trip: Trip; participant: TripParticipant }> {
  const supabase = createServiceRoleClient();
  const tripId = randomUUID();
  const participantId = randomUUID();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      id: tripId,
      name: `Playwright Trip ${tripId.slice(0, 8)}`,
      description: "Trip created by Playwright test helper.",
      image_url: null,
      location_name: "Tokyo, Japan",
      latitude: 35.6762,
      longitude: 139.6503,
      start_date: "2026-05-01",
      end_date: "2026-05-05",
      default_planner_permission: false,
      created_by: organizerId,
    })
    .select()
    .single();

  if (tripError) {
    throw tripError;
  }

  const { data: participant, error: participantError } = await supabase
    .from("trip_participants")
    .insert({
      id: participantId,
      trip_id: tripId,
      user_id: organizerId,
      nickname: "Organizer",
      role: "organizer",
      arrival_time: null,
      departure_time: null,
      arrival_location: null,
      departure_location: null,
    })
    .select()
    .single();

  if (participantError) {
    throw participantError;
  }

  return { trip, participant };
}

export async function createTestInviteCode(
  tripId: string,
  codeType: InviteCodeType,
): Promise<InviteCode> {
  const supabase = createServiceRoleClient();
  const createdBy = await getTripCreatorId(tripId);

  const { data, error } = await supabase
    .from("invite_codes")
    .insert({
      id: randomUUID(),
      trip_id: tripId,
      code: `pw-${randomUUID().replace(/-/g, "").slice(0, 10)}`,
      code_type: codeType,
      is_active: true,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function addParticipant(
  tripId: string,
  userId: string,
  role: TripParticipantRole,
): Promise<TripParticipant> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("trip_participants")
    .insert({
      id: randomUUID(),
      trip_id: tripId,
      user_id: userId,
      nickname: null,
      role,
      arrival_time: null,
      departure_time: null,
      arrival_location: null,
      departure_location: null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createTestItineraryItem(
  tripId: string,
  type: ItineraryItemType,
): Promise<ItineraryItem> {
  const supabase = createServiceRoleClient();
  const createdBy = await getTripCreatorId(tripId);

  const { data, error } = await supabase
    .from("itinerary_items")
    .insert({
      id: randomUUID(),
      trip_id: tripId,
      item_type: type,
      title: `Playwright ${type} item`,
      description: "Itinerary item created by Playwright seed helper.",
      image_url: null,
      day_date: "2026-05-02",
      start_time: null,
      end_time: null,
      location_name: "Tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
      destination_name: type === "commute" ? "Kyoto" : null,
      destination_latitude: type === "commute" ? 35.0116 : null,
      destination_longitude: type === "commute" ? 135.7681 : null,
      sort_order: 0,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function insertEventRsvp(
  itineraryItemId: string,
  userId: string,
  status: RsvpStatus,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("event_rsvps").insert({
    itinerary_item_id: itineraryItemId,
    user_id: userId,
    status,
  });
  if (error) {
    throw error;
  }
}

export async function insertEventComment(
  itineraryItemId: string,
  userId: string,
  options: { content?: string | null; gifUrl?: string | null },
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { content = null, gifUrl = null } = options;
  if (content === null && gifUrl === null) {
    throw new Error("Event comment must have content or gifUrl");
  }
  const { error } = await supabase.from("event_comments").insert({
    itinerary_item_id: itineraryItemId,
    user_id: userId,
    content,
    gif_url: gifUrl,
  });
  if (error) {
    throw error;
  }
}
