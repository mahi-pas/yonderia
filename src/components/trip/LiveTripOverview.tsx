"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ItineraryWithComments from "@/components/trip/ItineraryWithComments";
import EditMyInfoButton from "@/components/trip/EditMyInfoButton";
import ParticipantsRow from "@/components/trip/ParticipantsRow";
import TripMap from "@/components/trip/TripMap";
import { useEventCommentCounts } from "@/hooks/useEventCommentCounts";
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
  | "role"
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
    removeLocalItem,
    upsertLocalItem,
  } = useItinerary({
    initialItems: initialItineraryItems,
    tripId,
  });
  const itineraryItemIds = useMemo(
    () => itineraryItems.map((i) => i.id),
    [itineraryItems],
  );
  const commentCountByItemId = useEventCommentCounts({
    itineraryItemIds,
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
      <TripMap
        currentUserId={currentUserId}
        items={itineraryItems}
        onDeleted={removeLocalItem}
        onUpdated={upsertLocalItem}
        tripEndDate={tripEndDate}
        tripId={tripId}
        tripStartDate={tripStartDate}
        userRole={currentParticipant?.role ?? null}
      />
      <ItineraryWithComments
        canManage={canManageItinerary}
        commentCountByItemId={commentCountByItemId}
        currentUserId={currentUserId}
        currentUserRole={currentParticipant?.role ?? null}
        error={itineraryError}
        groupedByDay={groupedByDay}
        isLoading={isItineraryLoading}
        items={itineraryItems}
        onDeleted={removeLocalItem}
        onCreated={upsertLocalItem}
        onUpdated={upsertLocalItem}
        tripEndDate={tripEndDate}
        tripId={tripId}
        tripStartDate={tripStartDate}
      />
    </>
  );
}
