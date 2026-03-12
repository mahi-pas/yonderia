"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type UseEventCommentCountsOptions = {
  enabled?: boolean;
  itineraryItemIds: string[];
};

export function useEventCommentCounts({
  enabled = true,
  itineraryItemIds,
}: UseEventCommentCountsOptions): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    if (itineraryItemIds.length === 0) {
      setCounts({});
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("event_comments")
      .select("itinerary_item_id")
      .in("itinerary_item_id", itineraryItemIds);

    if (error) {
      setCounts({});
      return;
    }

    const next: Record<string, number> = {};
    for (const id of itineraryItemIds) {
      next[id] = 0;
    }
    type CommentRow = { itinerary_item_id: string };
    for (const row of (data ?? []) as CommentRow[]) {
      const id = row.itinerary_item_id;
      if (id) next[id] = (next[id] ?? 0) + 1;
    }
    setCounts(next);
  }, [itineraryItemIds]);

  useEffect(() => {
    if (!enabled || itineraryItemIds.length === 0) {
      setCounts({});
      return;
    }

    void fetchCounts();

    const supabase = createClient();
    let isMounted = true;
    const channel = supabase
      .channel(`event_comment_counts:${itineraryItemIds.join(",")}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_comments",
        },
        (payload) => {
          if (!isMounted) return;
          const itemId =
            (payload.new as { itinerary_item_id?: string })?.itinerary_item_id ??
            (payload.old as { itinerary_item_id?: string })?.itinerary_item_id;
          if (itemId && itineraryItemIds.includes(itemId)) {
            void fetchCounts();
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [enabled, itineraryItemIds.join(","), fetchCounts]);

  return counts;
}
