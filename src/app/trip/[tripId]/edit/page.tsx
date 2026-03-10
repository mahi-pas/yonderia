import { notFound, redirect } from "next/navigation";
import TripEditForm from "@/components/trip/TripEditForm";
import { createClient } from "@/lib/supabase/server";
import { getParticipantMembership } from "@/lib/trips";
import type { Trip } from "@/lib/types";

type PageProps = {
  params: Promise<{
    tripId: string;
  }>;
};

type EditableTrip = Pick<
  Trip,
  "description" | "end_date" | "id" | "image_url" | "latitude" | "location_name" | "longitude" | "name" | "start_date"
>;

export default async function TripEditPage({ params }: PageProps) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirectTo=${encodeURIComponent(`/trip/${tripId}/edit`)}`);
  }

  const membership = await getParticipantMembership(supabase, tripId, user.id);

  if (!membership || membership.role !== "organizer") {
    redirect(`/trip/${tripId}`);
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, name, description, image_url, location_name, latitude, longitude, start_date, end_date")
    .eq("id", tripId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!trip) {
    notFound();
  }

  const editableTrip = trip as EditableTrip;

  return (
    <TripEditForm
      initialTrip={{
        description: editableTrip.description,
        endDate: editableTrip.end_date,
        imageUrl: editableTrip.image_url,
        location: {
          latitude: editableTrip.latitude,
          longitude: editableTrip.longitude,
          name: editableTrip.location_name ?? "",
        },
        name: editableTrip.name,
        startDate: editableTrip.start_date,
      }}
      tripId={editableTrip.id}
    />
  );
}
