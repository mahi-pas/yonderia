import { NextResponse } from "next/server";
import { getNotificationsForUser, getUnreadNotificationCount } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ unreadCount: 0 }, { status: 401 });
  }

  const notifications = await getNotificationsForUser(supabase, user.id);
  return NextResponse.json({ unreadCount: getUnreadNotificationCount(notifications) });
}
