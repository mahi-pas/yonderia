"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RsvpStatus } from "@/lib/types";

type UseMyEventRsvpsOptions = {
  currentUserId: string | null;
  enabled?: boolean;
  itineraryItemIds: string[];
};

/**
 * Fetches the current user's RSVP status for each itinerary item.
 * Used so the Comments tab "Events I'm going to" filter works even when
 * itinerary items from useItinerary don't have rsvpSummary (e.g. after client refetch).
 */
export function useMyEventRsvps({
  currentUserId,
  enabled = true,
  itineraryItemIds,
}: UseMyEventRsvpsOptions): Map<string, RsvpStatus> {
  const [rows, setRows] = useState<{ itinerary_item_id: string; status: string }[]>([]);

  const idsKey = useMemo(() => itineraryItemIds.join(","), [itineraryItemIds]);

  useEffect(() => {
    if (!enabled || !currentUserId || itineraryItemIds.length === 0) {
      setRows([]);
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    const fetchRsvps = async () => {
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("itinerary_item_id, status")
        .eq("user_id", currentUserId)
        .in("itinerary_item_id", itineraryItemIds);

      if (!isMounted) return;
      if (error) {
        setRows([]);
        return;
      }
      setRows((data ?? []) as { itinerary_item_id: string; status: string }[]);
    };

    void fetchRsvps();

    const channel = supabase
      .channel(`my_event_rsvps:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_rsvps",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const record = payload.new as { itinerary_item_id?: string; status?: string } | undefined;
          const oldRecord = payload.old as { itinerary_item_id?: string } | undefined;
          const itemId = record?.itinerary_item_id ?? oldRecord?.itinerary_item_id;
          if (!itemId) return;
          setRows((prev) => {
            const rest = prev.filter((r) => r.itinerary_item_id !== itemId);
            if (payload.eventType === "DELETE") return rest;
            if (record?.status) return [...rest, { itinerary_item_id: itemId, status: record.status }];
            return rest;
          });
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, enabled, idsKey, itineraryItemIds]);

  return useMemo(() => {
    const map = new Map<string, RsvpStatus>();
    for (const r of rows) {
      if (r.status === "going" || r.status === "interested" || r.status === "not_going") {
        map.set(r.itinerary_item_id, r.status as RsvpStatus);
      }
    }
    return map;
  }, [rows]);
}
