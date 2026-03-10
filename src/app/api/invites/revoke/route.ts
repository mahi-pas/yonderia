import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getParticipantMembership } from "@/lib/trips";

type RevokeInviteRequest = {
  inviteId?: unknown;
  tripId?: unknown;
};

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function POST(request: Request) {
  let payload: RevokeInviteRequest;

  try {
    payload = (await request.json()) as RevokeInviteRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const inviteId = getStringValue(payload.inviteId);
  const tripId = getStringValue(payload.tripId);

  if (!inviteId || !tripId) {
    return NextResponse.json({ error: "Trip ID and invite ID are required." }, { status: 400 });
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

  if (!membership || (membership.role !== "organizer" && membership.role !== "planner")) {
    return NextResponse.json({ error: "Only organizers and planners can revoke invites." }, { status: 403 });
  }

  const { data: invite, error: inviteError } = await adminSupabase
    .from("invite_codes")
    .select("id, is_active, trip_id")
    .eq("id", inviteId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (inviteError) {
    throw new Error(inviteError.message);
  }

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (!invite.is_active) {
    return NextResponse.json({ success: true });
  }

  const { error: updateError } = await adminSupabase
    .from("invite_codes")
    .update({ is_active: false })
    .eq("id", inviteId)
    .eq("trip_id", tripId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return NextResponse.json({ success: true });
}
