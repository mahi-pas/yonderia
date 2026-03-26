import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/delete-account
 *
 * Deletes the authenticated user's account and all associated data.
 * Required by both App Store and Play Store.
 *
 * Steps:
 * 1. Delete profile (cascades to trip_participants, etc. via FK)
 * 2. Delete device_tokens
 * 3. Delete notification_reads
 * 4. Delete the Supabase Auth user
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // Delete user data from application tables
  // The profiles table has auth.users FK with ON DELETE CASCADE,
  // but we also clean up related tables explicitly for safety.
  const cleanupOps = [
    adminSupabase.from("device_tokens").delete().eq("user_id", user.id),
    adminSupabase.from("notification_reads").delete().eq("user_id", user.id),
    adminSupabase.from("event_comment_reactions").delete().eq("user_id", user.id),
    adminSupabase.from("event_comments").delete().eq("user_id", user.id),
    adminSupabase.from("event_rsvps").delete().eq("user_id", user.id),
    adminSupabase.from("trip_participants").delete().eq("user_id", user.id),
  ];

  const cleanupResults = await Promise.all(cleanupOps);
  const cleanupError = cleanupResults.find((r) => r.error);
  if (cleanupError?.error) {
    return NextResponse.json(
      { error: `Failed to clean up user data: ${cleanupError.error.message}` },
      { status: 500 },
    );
  }

  // Delete profile
  const { error: profileError } = await adminSupabase
    .from("profiles")
    .delete()
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json(
      { error: `Failed to delete profile: ${profileError.message}` },
      { status: 500 },
    );
  }

  // Delete the Supabase Auth user
  const { error: authError } = await adminSupabase.auth.admin.deleteUser(user.id);

  if (authError) {
    return NextResponse.json(
      { error: `Failed to delete auth account: ${authError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
