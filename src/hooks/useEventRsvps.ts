"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventRsvp, RsvpStatus, RsvpSummary } from "@/lib/types";

type UseEventRsvpsOptions = {
  enabled?: boolean;
  itineraryItemId: string | null;
  currentUserId: string | null;
};

export function computeSummary(rsvps: EventRsvp[], currentUserId: string | null): RsvpSummary {
  let going = 0;
  let interested = 0;
  let not_going = 0;
  let userStatus: RsvpStatus | null = null;

  for (const r of rsvps) {
    if (r.status === "going") going++;
    else if (r.status === "interested") interested++;
    else if (r.status === "not_going") not_going++;
    if (currentUserId && r.user_id === currentUserId) {
      userStatus = r.status;
    }
  }

  return { going, interested, not_going, userStatus };
}

export function useEventRsvps({
  enabled = true,
  itineraryItemId,
  currentUserId,
}: UseEventRsvpsOptions) {
  const [error, setError] = useState<string | null>(null);
  const [rsvps, setRsvps] = useState<EventRsvp[]>([]);

  const summary = useMemo(
    () => computeSummary(rsvps, currentUserId),
    [rsvps, currentUserId],
  );

  const setRsvp = useCallback(
    async (status: RsvpStatus | null) => {
      if (!itineraryItemId || !currentUserId) {
        return;
      }

      const supabase = createClient();
      const previousRsvps = rsvps;
      const existing = rsvps.find((r) => r.user_id === currentUserId);

      if (status === null) {
        setRsvps((prev) => prev.filter((r) => r.user_id !== currentUserId));
        const { error: deleteError } = await supabase
          .from("event_rsvps")
          .delete()
          .eq("itinerary_item_id", itineraryItemId)
          .eq("user_id", currentUserId);

        if (deleteError) {
          setRsvps(previousRsvps);
          setError(deleteError.message);
          throw deleteError;
        }
        setError(null);
        return;
      }

      const optimisticRow: EventRsvp = existing
        ? { ...existing, status, updated_at: new Date().toISOString() }
        : {
            id: "",
            itinerary_item_id: itineraryItemId,
            user_id: currentUserId,
            status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
      setRsvps((prev) => {
        const rest = prev.filter((r) => r.user_id !== currentUserId);
        return [...rest, optimisticRow];
      });

      const { error: upsertError } = await supabase
        .from("event_rsvps")
        .upsert(
          {
            itinerary_item_id: itineraryItemId,
            user_id: currentUserId,
            status,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "itinerary_item_id,user_id" },
        );

      if (upsertError) {
        setRsvps(previousRsvps);
        setError(upsertError.message);
        throw upsertError;
      }
      setError(null);
    },
    [itineraryItemId, currentUserId, rsvps],
  );

  useEffect(() => {
    if (!enabled || !itineraryItemId) {
      setRsvps([]);
      setError(null);
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    const fetchRsvps = async () => {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("event_rsvps")
        .select("id, itinerary_item_id, user_id, status, created_at, updated_at")
        .eq("itinerary_item_id", itineraryItemId);

      if (!isMounted) return;
      if (fetchError) {
        setError(fetchError.message);
        setRsvps([]);
        return;
      }
      setRsvps((data ?? []) as EventRsvp[]);
    };

    void fetchRsvps();

    const channel = supabase
      .channel(`event_rsvps:${itineraryItemId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `itinerary_item_id=eq.${itineraryItemId}`,
          schema: "public",
          table: "event_rsvps",
        },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string })?.id;
            if (id) {
              setRsvps((prev) => prev.filter((r) => r.id !== id));
            }
            return;
          }
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const row = payload.new as EventRsvp;
            setRsvps((prev) => {
              const rest = prev.filter((r) => r.user_id !== row.user_id);
              return [...rest, row];
            });
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [enabled, itineraryItemId]);

  return {
    error,
    rsvps,
    setRsvp,
    summary,
  };
}
