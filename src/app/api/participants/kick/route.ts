import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { getParticipantMembership } from "@/lib/trips";

type KickParticipantRequest = {
  participantId?: unknown;
  tripId?: unknown;
};

type ParticipantRow = Pick<
  Database["public"]["Tables"]["trip_participants"]["Row"],
  "id" | "role" | "trip_id" | "user_id"
>;

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function POST(request: Request) {
  let payload: KickParticipantRequest;

  try {
    payload = (await request.json()) as KickParticipantRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const participantId = getStringValue(payload.participantId);
  const tripId = getStringValue(payload.tripId);

  if (!participantId || !tripId) {
    return NextResponse.json({ error: "Trip ID and participant ID are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "You need to sign in first." }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const membership = await getParticipantMembership(adminSupabase, tripId, user.id);

  if (!membership || membership.role !== "organizer") {
    return NextResponse.json({ error: "Only the organizer can remove participants." }, { status: 403 });
  }

  const { data: participant, error: participantError } = await adminSupabase
    .from("trip_participants")
    .select("id, trip_id, user_id, role")
    .eq("id", participantId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (participantError) {
    throw new Error(participantError.message);
  }

  if (!participant) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  const resolvedParticipant = participant as ParticipantRow;

  if (resolvedParticipant.user_id === user.id) {
    return NextResponse.json({ error: "The organizer can't remove themselves from the trip." }, { status: 403 });
  }

  if (resolvedParticipant.role === "organizer") {
    return NextResponse.json({ error: "The organizer can't be removed from the trip." }, { status: 403 });
  }

  const { error: deleteError } = await adminSupabase
    .from("trip_participants")
    .delete()
    .eq("id", participantId)
    .eq("trip_id", tripId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return NextResponse.json({ success: true });
}
