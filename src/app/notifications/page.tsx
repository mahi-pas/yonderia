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
    <main className="page-bg relative min-h-screen px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-4xl space-y-6">
        <header className="border-2 sm:border-4 border-[#121212] bg-white p-6 shadow-[6px_6px_0px_0px_black] sm:p-8">
          <div className="mb-2 h-2 w-2 rounded-full bg-[#D02020]" />
          <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Notifications</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-5xl lg:text-6xl">
            Stay in the loop
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[#888888] sm:text-base">
            New trip events, announcements, and comment activity from the plans you&apos;re part of
            all land here.
          </p>
        </header>

        <NotificationsPageClient notifications={notifications} />
      </div>
    </main>
  );
}
