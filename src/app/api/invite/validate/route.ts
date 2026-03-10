import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database, TripParticipantRole } from "@/lib/types";
import { getInviteCodeLookup, getParticipantMembership } from "@/lib/trips";

type ValidateInviteRequest = {
  code?: unknown;
  tripId?: unknown;
};

type TripPlannerPreferenceRow = Pick<
  Database["public"]["Tables"]["trips"]["Row"],
  "default_planner_permission" | "id"
>;
type ParticipantIdRow = Pick<Database["public"]["Tables"]["trip_participants"]["Row"], "id">;

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "23505"
  );
}

export async function POST(request: Request) {
  let payload: ValidateInviteRequest;

  try {
    payload = (await request.json()) as ValidateInviteRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const code = getStringValue(payload.code);
  const tripId = getStringValue(payload.tripId);

  if (!code || !tripId) {
    return NextResponse.json({ error: "Trip ID and invite code are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "You need to sign in before joining a trip." }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const inviteCode = await getInviteCodeLookup(adminSupabase, tripId, code);

  if (!inviteCode) {
    return NextResponse.json({ error: "That invite code is invalid or no longer active." }, { status: 403 });
  }

  if (inviteCode.codeType === "view") {
    return NextResponse.json(
      { error: "That invite code is view-only. Use a join invite instead." },
      { status: 400 },
    );
  }

  const existingParticipant = await getParticipantMembership(adminSupabase, tripId, user.id);

  if (existingParticipant) {
    return NextResponse.json({
      alreadyParticipant: true,
      participantId: existingParticipant.id,
      redirectTo: `/trip/${tripId}`,
      success: true,
      tripId,
    });
  }

  const { data: trip, error: tripError } = await adminSupabase
    .from("trips")
    .select("id, default_planner_permission")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError) {
    throw new Error(tripError.message);
  }

  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const resolvedTrip = trip as TripPlannerPreferenceRow;
  const role: TripParticipantRole =
    inviteCode.codeType === "join_planner" || resolvedTrip.default_planner_permission ? "planner" : "member";

  const newParticipant: Database["public"]["Tables"]["trip_participants"]["Insert"] = {
    arrival_location: null,
    arrival_time: null,
    departure_location: null,
    departure_time: null,
    id: crypto.randomUUID(),
    nickname: null,
    role,
    trip_id: tripId,
    user_id: user.id,
  };

  const participantInsertQuery = adminSupabase.from("trip_participants");
  const { data: insertedParticipant, error: insertError } = await participantInsertQuery
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .insert(newParticipant)
    .select("id")
    .single();

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      const concurrentParticipant = await getParticipantMembership(adminSupabase, tripId, user.id);

      if (concurrentParticipant) {
        return NextResponse.json({
          alreadyParticipant: true,
          participantId: concurrentParticipant.id,
          redirectTo: `/trip/${tripId}`,
          success: true,
          tripId,
        });
      }
    }

    throw new Error(insertError.message);
  }

  const resolvedParticipant = insertedParticipant as ParticipantIdRow;
  return NextResponse.json({
    alreadyParticipant: false,
    participantId: resolvedParticipant.id,
    redirectTo: `/trip/${tripId}`,
    success: true,
    tripId,
  });
}
