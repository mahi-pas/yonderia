import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";
import { getParticipantMembership } from "@/lib/trips";

type ChangeParticipantNicknameRequest = {
  nickname?: unknown;
  participantId?: unknown;
  tripId?: unknown;
};

type ParticipantRow = Pick<
  Database["public"]["Tables"]["trip_participants"]["Row"],
  "id" | "nickname" | "role" | "trip_id" | "user_id"
>;

function getStringValue(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

export async function POST(request: Request) {
  let payload: ChangeParticipantNicknameRequest;

  try {
    payload = (await request.json()) as ChangeParticipantNicknameRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const participantId = getStringValue(payload.participantId);
  const tripId = getStringValue(payload.tripId);
  const nickname = getStringValue(payload.nickname);

  if (!participantId || !tripId || nickname === null) {
    return NextResponse.json(
      { error: "Trip ID, participant ID, and nickname are required." },
      { status: 400 },
    );
  }

  if (nickname.length === 0) {
    return NextResponse.json({ error: "Nickname cannot be empty." }, { status: 400 });
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
    return NextResponse.json({ error: "Only the organizer can change participant nicknames." }, { status: 403 });
  }

  const { data: participant, error: participantError } = await adminSupabase
    .from("trip_participants")
    .select("id, trip_id, user_id, role, nickname")
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

  if (resolvedParticipant.user_id === user.id || resolvedParticipant.role === "organizer") {
    return NextResponse.json({ error: "The organizer can't change their own nickname here." }, { status: 403 });
  }

  const nextNickname = nickname;

  if ((resolvedParticipant.nickname ?? null) === nextNickname) {
    return NextResponse.json({
      previousNickname: resolvedParticipant.nickname,
      success: true,
      updatedNickname: nextNickname,
    });
  }

  const participantUpdateQuery = adminSupabase.from("trip_participants");
  const { error: updateError } = await participantUpdateQuery
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update({ nickname: nextNickname })
    .eq("id", participantId)
    .eq("trip_id", tripId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return NextResponse.json({
    previousNickname: resolvedParticipant.nickname,
    success: true,
    updatedNickname: nextNickname,
  });
}
