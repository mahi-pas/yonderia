import { redirect } from "next/navigation";
import AuthButtons from "@/components/auth/AuthButtons";
import { createClient } from "@/lib/supabase/server";
import { Circle, Square, Triangle } from "lucide-react";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F0F0F0]">
      {/* Dot pattern background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        aria-hidden="true"
        style={{
          backgroundImage: "radial-gradient(#121212 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Top border stripe */}
      <div className="h-2 bg-[#D02020]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-8px)] max-w-7xl flex-col lg:flex-row">
        {/* Left panel – content */}
        <div className="flex flex-1 flex-col justify-between px-6 py-8 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
          {/* Geometric logo */}
          <div className="flex items-center gap-2">
            <Circle className="h-5 w-5 fill-[#D02020] text-[#D02020]" />
            <Square className="h-5 w-5 fill-[#1040C0] text-[#1040C0]" />
            <Triangle className="h-5 w-5 fill-[#F0C020] text-[#F0C020]" />
            <span className="ml-2 text-sm font-bold uppercase tracking-widest text-[#121212]">
              Yonderia
            </span>
          </div>

          <section className="py-10 lg:py-0">
            <p className="text-xs font-bold tracking-wide text-[#D02020] sm:text-sm">
              Effortlessly stylish trip invites
            </p>
            <h1 className="mt-4 font-display text-5xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-7xl lg:text-8xl">
              Yonderia
            </h1>
            <p className="mt-5 max-w-md text-lg font-medium leading-7 text-[#121212]/80 sm:text-xl">
              Plan trips beautifully.
            </p>
            <p className="mt-3 max-w-md text-sm font-medium leading-6 text-[#888888]">
              Invite your crew, keep the itinerary in one place, and make trip plans feel as
              fun as the trip itself.
            </p>

            <div className="mt-10">
              <AuthButtons />
            </div>
          </section>

          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <div className="border-2 border-[#121212] bg-white p-4 shadow-[4px_4px_0px_0px_black]">
              <div className="mb-2 h-2 w-2 bg-[#D02020]" />
              <p className="text-xs font-bold uppercase tracking-widest text-[#121212]">Invites</p>
              <p className="mt-2 text-sm font-medium text-[#888888]">Share join or view-only links in seconds.</p>
            </div>
            <div className="border-2 border-[#121212] bg-white p-4 shadow-[4px_4px_0px_0px_black]">
              <div className="mb-2 h-2 w-2 rounded-full bg-[#1040C0]" />
              <p className="text-xs font-bold uppercase tracking-widest text-[#121212]">Itinerary</p>
              <p className="mt-2 text-sm font-medium text-[#888888]">Keep every plan, stop, and detail together.</p>
            </div>
          </div>
        </div>

        {/* Right panel – hero video */}
        <div className="relative hidden min-h-[min(100vh,720px)] overflow-hidden border-l-4 border-[#121212] bg-[#1a2332] lg:flex lg:min-h-[calc(100vh-8px)] lg:w-[45%]">
          <video
            className="absolute inset-0 h-full min-h-full w-full scale-[1.02] object-cover"
            src="/opening_splash.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          {/* Muted cool wash + soften toward the left seam */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#7d8ca3]/40 via-[#8f9eb0]/14 to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[#9aa8b8]/10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/25 to-transparent"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Bottom border stripe */}
      <div className="h-1 bg-[#121212]" aria-hidden="true" />
    </main>
  );
}
