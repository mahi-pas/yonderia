import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantMembership } from "@/lib/trips";
import { validateTripTheme } from "@/lib/trip-theme";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const membership = await getParticipantMembership(supabase, tripId, user.id);

  if (!membership || membership.role !== "organizer") {
    return NextResponse.json(
      { error: "Only the trip organizer can update the theme." },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const themePayload =
    typeof body === "object" && body !== null && "theme" in body
      ? (body as { theme: unknown }).theme
      : body;

  const result = validateTripTheme(themePayload);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { error } = await supabase
    .from("trips")
    .update({ theme: result.theme } as never)
    .eq("id", tripId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update theme." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
