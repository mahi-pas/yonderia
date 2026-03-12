import { redirect } from "next/navigation";
import LoginButton from "@/components/auth/LoginButton";
import PageBackground from "@/components/ui/PageBackground";
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
    <main className="hero-gradient relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
      <PageBackground />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute left-[10%] top-[15%] h-16 w-16 rounded-full border border-[#8b5cf6]/10 opacity-40"
          style={{ animation: "float-shape 12s ease-in-out infinite" }}
        />
        <div
          className="absolute right-[15%] top-[25%] h-24 w-24 rounded-2xl border border-[#ec4899]/10 opacity-30 rotate-12"
          style={{ animation: "float-shape 16s ease-in-out infinite 2s" }}
        />
        <div
          className="absolute left-[60%] top-[60%] h-12 w-12 rounded-full border border-[#8b5cf6]/8 opacity-25"
          style={{ animation: "float-shape 14s ease-in-out infinite 4s" }}
        />
        <div
          className="absolute left-[5%] bottom-[30%] h-20 w-20 rounded-xl border border-[#ec4899]/8 opacity-20 -rotate-6"
          style={{ animation: "float-shape 18s ease-in-out infinite 1s" }}
        />
      </div>

      <div className="relative z-10 flex min-h-[calc(100vh-2rem)] flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)]/20 p-5 shadow-[0_4px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:min-h-[calc(100vh-3rem)] sm:rounded-2xl sm:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--accent-gradient)] opacity-30 rounded-t-2xl" />

        <div className="flex items-center justify-between">
          <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)]/40 px-3 py-2 text-xs font-semibold tracking-wide uppercase backdrop-blur">
            <span className="gradient-text">Yonderia</span>
          </div>
        </div>

        <section className="flex flex-1 flex-col justify-center py-10">
          <div className="max-w-md">
            <p className="mb-4 text-xs font-semibold tracking-wide uppercase gradient-text">
              Group trips, elevated
            </p>
            <h1 className="font-display text-[clamp(3.3rem,18vw,4.75rem)] leading-[0.9] text-[#fafafa] drop-shadow-[0_10px_30px_rgba(139,92,246,0.15)] sm:text-7xl">
              Yonderia
            </h1>
            <p className="mt-5 max-w-[14rem] text-lg leading-7 text-[#d4d4d8] sm:max-w-sm">
              Plan adventures with your people.
            </p>
            <p className="mt-3 max-w-[18rem] text-sm leading-6 text-[var(--muted)] sm:max-w-sm">
              Invite your crew, keep the itinerary in one place, and make trip plans feel as
              fun as the trip itself.
            </p>
          </div>

          <div className="mt-10">
            <LoginButton />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 text-left sm:max-w-md">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-xs font-semibold tracking-wide uppercase gradient-text">Invites</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Share join or view-only links in seconds.</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-xs font-semibold tracking-wide uppercase gradient-text">Itinerary</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Keep every plan, stop, and detail together.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
