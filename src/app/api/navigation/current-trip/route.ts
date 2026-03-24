import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";

type TripPick = Pick<Trip, "end_date" | "id" | "start_date">;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ tripId: null }, { status: 401 });
  }

  const hint = new URL(request.url).searchParams.get("hint")?.trim() ?? "";

  if (hint && UUID_RE.test(hint)) {
    const { data: membershipData } = await supabase
      .from("trip_participants")
      .select("trip_id")
      .eq("trip_id", hint)
      .eq("user_id", user.id)
      .maybeSingle();

    const membership = membershipData as { trip_id: string } | null;

    if (membership?.trip_id) {
      return NextResponse.json({ tripId: hint });
    }
  }

  const { data: membershipRows, error: membershipError } = await supabase
    .from("trip_participants")
    .select("trip_id")
    .eq("user_id", user.id);

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const rows = (membershipRows ?? []) as { trip_id: string }[];
  const tripIds = [...new Set(rows.map((row) => row.trip_id))];

  if (tripIds.length === 0) {
    return NextResponse.json({ tripId: null });
  }

  const { data: tripsData, error: tripsError } = await supabase
    .from("trips")
    .select("id, start_date, end_date")
    .in("id", tripIds);

  if (tripsError) {
    return NextResponse.json({ error: tripsError.message }, { status: 500 });
  }

  const trips = (tripsData ?? []) as TripPick[];

  if (trips.length === 0) {
    return NextResponse.json({ tripId: null });
  }

  const today = getTodayDateString();
  const upcoming = trips
    .filter((t) => t.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  if (upcoming.length > 0) {
    return NextResponse.json({ tripId: upcoming[0].id });
  }

  // No valid last-viewed trip (or user left it): do not fall back to past trips — prompt user to plan ahead.
  return NextResponse.json({ tripId: null });
}
