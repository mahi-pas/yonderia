import { NextResponse } from "next/server";
import { buildNotificationReadRows, isNotificationReadsTableUnavailable } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

type RequestBody = {
  notificationIds?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const notificationIds = Array.isArray(body?.notificationIds)
    ? body.notificationIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (notificationIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const notificationReadRows = buildNotificationReadRows(user.id, notificationIds) as never[];

  const { error } = await supabase
    .from("notification_reads")
    .upsert(notificationReadRows, {
      onConflict: "user_id,notification_id",
    });

  if (error) {
    if (isNotificationReadsTableUnavailable(error)) {
      return NextResponse.json({ ok: true, readsPersisted: false });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
