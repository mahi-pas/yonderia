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
    <main className="page-bg relative min-h-screen px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#D02020] sm:text-sm">New trip</p>
          <h1 className="font-display text-4xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-5xl lg:text-6xl">Create a trip</h1>
          <p className="max-w-xl text-sm font-medium leading-6 text-[#888888] sm:text-base">
            Give your trip a name, dates, a place, and a photo so your crew lands on something that
            already feels real.
          </p>
        </header>

        <section className="border-2 sm:border-4 border-[#121212] bg-white p-5 shadow-[6px_6px_0px_0px_black] sm:shadow-[8px_8px_0px_0px_black] sm:p-8">
          <CreateTripForm currentUserId={user.id} />
        </section>
      </div>
    </main>
  );
}
