import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { device_token?: string; platform?: string };
  try {
    body = (await request.json()) as { device_token?: string; platform?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deviceToken = body.device_token?.trim();
  const platform = body.platform?.trim();

  if (!deviceToken || !platform) {
    return NextResponse.json(
      { error: "device_token and platform are required" },
      { status: 400 },
    );
  }

  if (platform !== "ios" && platform !== "android") {
    return NextResponse.json(
      { error: "platform must be 'ios' or 'android'" },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();

  // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
  const { error } = await adminSupabase.from("device_tokens").upsert(
    {
      user_id: user.id,
      device_token: deviceToken,
      platform,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,device_token",
    },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
