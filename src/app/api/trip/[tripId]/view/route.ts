import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInviteCodeLookup, getTripPageData } from "@/lib/trips";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await context.params;
  const code = request.nextUrl.searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json({ error: "Missing invite code." }, { status: 403 });
  }

  const supabase = createAdminClient();
  const inviteCode = await getInviteCodeLookup(supabase, tripId, code);

  if (!inviteCode || inviteCode.codeType !== "view") {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
  }

  const tripData = await getTripPageData(supabase, tripId, {
    includeProfilePaths: false,
  });

  if (!tripData) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  return NextResponse.json(tripData);
}
