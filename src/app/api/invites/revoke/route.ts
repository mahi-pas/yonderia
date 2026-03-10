import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { getParticipantMembership } from "@/lib/trips";

type RevokeInviteRequest = {
  inviteId?: unknown;
  tripId?: unknown;
};

type InviteStatusRow = Pick<Database["public"]["Tables"]["invite_codes"]["Row"], "id" | "is_active" | "trip_id">;

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

  const resolvedInvite = invite as InviteStatusRow;

  if (!resolvedInvite.is_active) {
    return NextResponse.json({ success: true });
  }

  const inviteUpdateQuery = adminSupabase.from("invite_codes");
  const { error: updateError } = await inviteUpdateQuery
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update({ is_active: false })
    .eq("id", inviteId)
    .eq("trip_id", tripId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return NextResponse.json({ success: true });
}
