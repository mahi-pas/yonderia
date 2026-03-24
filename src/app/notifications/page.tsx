import { redirect } from "next/navigation";
import NotificationsPageClient from "@/components/notifications/NotificationsPageClient";
import PageBackground from "@/components/ui/PageBackground";
import { getNotificationsForUser } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const notifications = await getNotificationsForUser(supabase, user.id);

  return (
    <main className="page-bg relative min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-4xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/65 px-5 py-6 backdrop-blur-sm sm:px-7 sm:py-8">
          <p className="gradient-text text-xs font-semibold uppercase tracking-wide">Notifications</p>
          <h1 className="mt-3 font-display text-5xl leading-none text-[#fafafa] sm:text-6xl">
            Stay in the loop
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
            New trip events, announcements, and comment activity from the plans you&apos;re part of
            all land here.
          </p>
        </header>

        <NotificationsPageClient notifications={notifications} />
      </div>
    </main>
  );
}
