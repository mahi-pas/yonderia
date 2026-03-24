"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LAST_TRIP_UPDATED_EVENT, LAST_VIEWED_TRIP_STORAGE_KEY } from "@/lib/trip-navigation";

type LastTripTrackerProps = {
  tripId: string;
};

/** Persists last viewed trip for signed-in users (navbar “current trip”). */
export default function LastTripTracker({ tripId }: LastTripTrackerProps) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !tripId) {
      return;
    }

    try {
      localStorage.setItem(LAST_VIEWED_TRIP_STORAGE_KEY, tripId);
      window.dispatchEvent(new CustomEvent(LAST_TRIP_UPDATED_EVENT));
    } catch {
      // ignore quota / private mode
    }
  }, [tripId, user?.id]);

  return null;
}
