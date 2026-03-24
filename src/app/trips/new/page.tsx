import { redirect } from "next/navigation";
import CreateTripForm from "@/components/trip/CreateTripForm";
import PageBackground from "@/components/ui/PageBackground";
import { createClient } from "@/lib/supabase/server";

export default async function NewTripPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <main className="page-bg relative min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide gradient-text">New trip</p>
          <h1 className="font-display text-4xl leading-none text-[#fafafa] sm:text-5xl">Create a trip</h1>
          <p className="max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-base">
            Give your trip a name, dates, a place, and a photo so your crew lands on something that
            already feels real.
          </p>
        </header>

        <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/70 p-5 backdrop-blur-sm sm:p-8">
          <CreateTripForm currentUserId={user.id} />
        </section>
      </div>
    </main>
  );
}
