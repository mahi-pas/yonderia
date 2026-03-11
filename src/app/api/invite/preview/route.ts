import { NextResponse, type NextRequest } from "next/server";
import { getInvitePreview } from "@/lib/trips";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json({ error: "Missing invite code." }, { status: 400 });
  }

  const preview = await getInvitePreview(createAdminClient(), code);

  if (!preview) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  return NextResponse.json({
    code_type: preview.codeType,
    organizer: {
      avatar_url: preview.organizer.avatarUrl,
      display_name: preview.organizer.displayName,
    },
    trip: preview.trip,
  });
}
