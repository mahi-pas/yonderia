import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TripParticipantRole } from "@/lib/types";
import { getParticipantMembership } from "@/lib/trips";

type ChangeParticipantRoleRequest = {
  participantId?: unknown;
  role?: unknown;
  tripId?: unknown;
};

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isMutableRole(role: string | null): role is Extract<TripParticipantRole, "member" | "planner"> {
  return role === "member" || role === "planner";
}

export async function POST(request: Request) {
  let payload: ChangeParticipantRoleRequest;

  try {
    payload = (await request.json()) as ChangeParticipantRoleRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const participantId = getStringValue(payload.participantId);
  const role = getStringValue(payload.role);
  const tripId = getStringValue(payload.tripId);

  if (!participantId || !tripId || !isMutableRole(role)) {
    return NextResponse.json(
      { error: "Trip ID, participant ID, and a valid role are required." },
      { status: 400 },
    );
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
    return NextResponse.json({ error: "Only the organizer can change participant roles." }, { status: 403 });
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

  if (participant.user_id === user.id) {
    return NextResponse.json({ error: "The organizer can't change their own role." }, { status: 403 });
  }

  if (participant.role === "organizer") {
    return NextResponse.json({ error: "The organizer's role can't be changed." }, { status: 403 });
  }

  if (participant.role === role) {
    return NextResponse.json({ success: true, updatedRole: role });
  }

  const { error: updateError } = await adminSupabase
    .from("trip_participants")
    .update({ role })
    .eq("id", participantId)
    .eq("trip_id", tripId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return NextResponse.json({ success: true, updatedRole: role });
}
