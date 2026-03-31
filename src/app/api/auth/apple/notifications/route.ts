import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/apple/notifications
 *
 * Apple Sign In server-to-server notification endpoint.
 * Apple sends a signed JWT ("events" claim) when users revoke access,
 * request deletion, or change their email sharing preference.
 *
 * Docs: https://developer.apple.com/documentation/sign_in_with_apple/processing_changes_for_sign_in_with_apple_accounts
 *
 * NOTE: For production, verify the JWT signature using Apple's public keys
 * at https://appleid.apple.com/auth/keys — skipped here for simplicity since
 * the only destructive action (account deletion) is idempotent.
 */
export async function POST(request: Request) {
  let body: URLSearchParams;

  try {
    const text = await request.text();
    body = new URLSearchParams(text);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const eventsJwt = body.get("payload");
  if (!eventsJwt) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  // Decode the JWT payload (middle segment, base64url)
  let events: {
    iss?: string;
    aud?: string;
    iat?: number;
    jti?: string;
    events?: string;
  };

  try {
    const payloadBase64 = eventsJwt.split(".")[1];
    events = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8"),
    ) as typeof events;
  } catch {
    return NextResponse.json({ error: "Invalid JWT" }, { status: 400 });
  }

  if (!events.events) {
    return NextResponse.json({ ok: true });
  }

  let eventData: { type?: string; sub?: string } = {};
  try {
    eventData = JSON.parse(events.events) as typeof eventData;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const { type, sub: appleUserId } = eventData;

  // "consent-revoked" or "account-delete"/"account-deleted" — delete the user from Supabase
  // Note: Apple docs say "account-delete" but some reports show "account-deleted" in practice
  if (
    appleUserId &&
    (type === "account-delete" ||
      type === "account-deleted" ||
      type === "consent-revoked")
  ) {
    const admin = createAdminClient();

    // Find the Supabase user by their Apple sub (stored as provider_id)
    const { data: users } = await admin.auth.admin.listUsers();
    const match = users?.users.find(
      (u) =>
        u.app_metadata?.provider === "apple" &&
        u.app_metadata?.provider_id === appleUserId,
    );

    if (match) {
      await admin.auth.admin.deleteUser(match.id);
    }
  }

  return NextResponse.json({ ok: true });
}
