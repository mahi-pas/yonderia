import { redirect } from "next/navigation";
import LoginButton from "@/components/auth/LoginButton";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#ffe2d2_0%,#ffd0bd_26%,#ffc1a5_45%,#f8a77d_72%,#ef8b64_100%)] px-4 py-5 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.42),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(255,240,228,0.56),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(122,45,19,0.18),transparent_30%)]" />

      <div className="relative flex min-h-[calc(100vh-2rem)] flex-col justify-between rounded-[2.5rem] border border-white/35 bg-[linear-gradient(180deg,rgba(255,251,247,0.36),rgba(255,247,240,0.14))] p-5 shadow-[0_28px_80px_rgba(104,45,20,0.18)] backdrop-blur-sm sm:min-h-[calc(100vh-3rem)] sm:p-8">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center rounded-full border border-white/45 bg-white/35 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-[#6f3320] shadow-sm">
            Yonderia
          </div>
        </div>

        <section className="flex flex-1 flex-col justify-center py-10">
          <div className="max-w-md">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#8d462d]">
              Group trips, but warmer
            </p>
            <h1 className="font-display text-6xl leading-[0.9] text-[#35160e] drop-shadow-[0_10px_30px_rgba(255,255,255,0.25)] sm:text-7xl">
              Yonderia
            </h1>
            <p className="mt-5 max-w-xs text-lg leading-7 text-[#5f3427] sm:max-w-sm">
              Plan adventures with your people.
            </p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#74473a]">
              Invite your crew, keep the itinerary in one place, and make trip plans feel as
              fun as the trip itself.
            </p>
          </div>

          <div className="mt-10">
            <LoginButton />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 text-left sm:max-w-md">
          <div className="rounded-[1.75rem] border border-white/45 bg-white/35 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9b5b42]">Invites</p>
            <p className="mt-2 text-sm text-[#5b3428]">Share join or view-only links in seconds.</p>
          </div>
          <div className="rounded-[1.75rem] border border-white/45 bg-white/35 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9b5b42]">Itinerary</p>
            <p className="mt-2 text-sm text-[#5b3428]">Keep every plan, stop, and detail together.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
