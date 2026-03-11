"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DayItinerary from "@/components/trip/DayItinerary";
import EditMyInfoButton from "@/components/trip/EditMyInfoButton";
import ParticipantsRow from "@/components/trip/ParticipantsRow";
import TripMap from "@/components/trip/TripMap";
import { useItinerary, type ItineraryListItem } from "@/hooks/useItinerary";
import { useParticipants, type ParticipantListItem } from "@/hooks/useParticipants";
import { createClient } from "@/lib/supabase/client";
import type { TripParticipant } from "@/lib/types";

type CurrentParticipant = Pick<
  TripParticipant,
  | "arrival_location"
  | "arrival_time"
  | "departure_location"
  | "departure_time"
  | "id"
  | "nickname"
>;

type LiveTripOverviewProps = {
  canManageItinerary: boolean;
  currentParticipant?: CurrentParticipant | null;
  currentUserId?: string;
  initialItineraryItems: ItineraryListItem[];
  initialParticipants: ParticipantListItem[];
  tripEndDate: string;
  tripId: string;
  tripStartDate: string;
};

export default function LiveTripOverview({
  canManageItinerary,
  currentParticipant = null,
  currentUserId,
  initialItineraryItems,
  initialParticipants,
  tripEndDate,
  tripId,
  tripStartDate,
}: LiveTripOverviewProps) {
  const router = useRouter();
  const {
    error: itineraryError,
    groupedByDay,
    isLoading: isItineraryLoading,
    itineraryItems,
    upsertLocalItem,
  } = useItinerary({
    initialItems: initialItineraryItems,
    tripId,
  });
  const { participants } = useParticipants({
    initialParticipants,
    tripId,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`trip-overview:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `trip_id=eq.${tripId}`,
          schema: "public",
          table: "trip_participants",
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, tripId]);

  return (
    <>
      <ParticipantsRow participants={participants} tripId={tripId} />
      {currentParticipant ? (
        <EditMyInfoButton
          initialValues={{
            arrivalLocation: currentParticipant.arrival_location,
            arrivalTime: currentParticipant.arrival_time,
            departureLocation: currentParticipant.departure_location,
            departureTime: currentParticipant.departure_time,
            nickname: currentParticipant.nickname,
          }}
          participantId={currentParticipant.id}
          tripId={tripId}
        />
      ) : null}
      <TripMap items={itineraryItems} tripEndDate={tripEndDate} tripStartDate={tripStartDate} />
      <DayItinerary
        canManage={canManageItinerary}
        currentUserId={currentUserId}
        error={itineraryError}
        groupedByDay={groupedByDay}
        isLoading={isItineraryLoading}
        items={itineraryItems}
        onCreated={upsertLocalItem}
        tripEndDate={tripEndDate}
        tripId={tripId}
        tripStartDate={tripStartDate}
      />
    </>
  );
}
