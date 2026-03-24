import { notFound, redirect } from "next/navigation";
import TripThemeEditor from "@/components/trip/TripThemeEditor";
import { createClient } from "@/lib/supabase/server";
import { getParticipantMembership } from "@/lib/trips";
import type { TripTheme } from "@/lib/types";

type PageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function TripCustomizePage({ params }: PageProps) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirectTo=${encodeURIComponent(`/trip/${tripId}/customize`)}`);
  }

  const membership = await getParticipantMembership(supabase, tripId, user.id);

  if (!membership || membership.role !== "organizer") {
    redirect(`/trip/${tripId}`);
  }

  const { data: tripRow, error } = await supabase
    .from("trips")
    .select("id, name, theme")
    .eq("id", tripId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!tripRow) {
    notFound();
  }

  const trip = tripRow as { id: string; name: string; theme: TripTheme | null };
  const theme = trip.theme && Object.keys(trip.theme).length > 0 ? trip.theme : null;

  return (
    <TripThemeEditor
      initialTheme={theme}
      tripId={trip.id}
      tripName={trip.name}
    />
  );
}
