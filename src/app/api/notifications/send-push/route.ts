import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types";

type DeviceTokenForPush = Pick<
  Database["public"]["Tables"]["device_tokens"]["Row"],
  "device_token" | "platform"
>;

/**
 * POST /api/notifications/send-push
 *
 * Sends a push notification to a specific user via FCM HTTP v1 API.
 * This route is intended to be called internally (e.g., from a Supabase
 * webhook/edge function when a notification row is inserted).
 *
 * Requires a shared secret in the Authorization header for security.
 *
 * Body: { user_id: string, title: string, body: string, data?: Record<string, string> }
 */

const INTERNAL_SECRET = process.env.PUSH_NOTIFICATIONS_SECRET;

export async function POST(request: Request) {
  // Verify internal secret
  const authHeader = request.headers.get("authorization");
  if (!INTERNAL_SECRET || authHeader !== `Bearer ${INTERNAL_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    user_id?: string;
    title?: string;
    body?: string;
    data?: Record<string, string>;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { user_id, title, body, data } = payload;

  if (!user_id || !title || !body) {
    return NextResponse.json(
      { error: "user_id, title, and body are required" },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();

  // Get all device tokens for the user
  const { data: tokens, error: tokensError } = await adminSupabase
    .from("device_tokens")
    .select("device_token, platform")
    .eq("user_id", user_id);

  if (tokensError) {
    return NextResponse.json({ error: tokensError.message }, { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ sent: 0, message: "No device tokens found" });
  }

  const tokenRows = tokens as DeviceTokenForPush[];

  // Send via FCM HTTP v1 API
  // Requires FIREBASE_PROJECT_ID and a valid FCM server key or service account
  const fcmServerKey = process.env.FCM_SERVER_KEY;
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;

  if (!fcmServerKey || !firebaseProjectId) {
    return NextResponse.json(
      {
        error: "FCM not configured. Set FCM_SERVER_KEY and FIREBASE_PROJECT_ID env vars.",
        tokens_found: tokens.length,
      },
      { status: 503 },
    );
  }

  let sentCount = 0;
  const errors: string[] = [];

  for (const tokenRow of tokenRows) {
    try {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${fcmServerKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: tokenRow.device_token,
              notification: { title, body },
              data: data ?? {},
            },
          }),
        },
      );

      if (response.ok) {
        sentCount++;
      } else {
        const errorText = await response.text();
        errors.push(`Token ${tokenRow.device_token.slice(0, 8)}...: ${errorText}`);

        // Remove invalid tokens (unregistered devices)
        if (response.status === 404 || response.status === 410) {
          await adminSupabase
            .from("device_tokens")
            .delete()
            .eq("device_token", tokenRow.device_token)
            .eq("user_id", user_id);
        }
      }
    } catch (err) {
      errors.push(
        `Token ${tokenRow.device_token.slice(0, 8)}...: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }

  return NextResponse.json({
    sent: sentCount,
    total: tokenRows.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
