import { eachDayOfInterval, format, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ItineraryItem } from "@/lib/types";

export type ItineraryListItem = Pick<
  ItineraryItem,
  | "day_date"
  | "description"
  | "destination_latitude"
  | "destination_longitude"
  | "destination_name"
  | "end_time"
  | "id"
  | "image_url"
  | "item_type"
  | "latitude"
  | "location_name"
  | "longitude"
  | "sort_order"
  | "start_time"
  | "title"
>;

type UseItineraryOptions = {
  enabled?: boolean;
  initialItems?: ItineraryListItem[];
  tripId: string;
};

function getItemStartDay(item: Pick<ItineraryListItem, "day_date" | "start_time">): string {
  if (!item.start_time) {
    return item.day_date;
  }

  return format(new Date(item.start_time), "yyyy-MM-dd");
}

function getItemEndDay(item: Pick<ItineraryListItem, "end_time">, fallbackDay: string): string {
  if (!item.end_time) {
    return fallbackDay;
  }

  return format(new Date(item.end_time), "yyyy-MM-dd");
}

export function getItineraryItemDaySpan(item: ItineraryListItem): string[] {
  if (!item.start_time) {
    return [item.day_date];
  }

  const startDay = getItemStartDay(item);

  if (!item.end_time) {
    return [startDay];
  }

  const endDay = getItemEndDay(item, startDay);

  if (endDay < startDay) {
    return [startDay];
  }

  return eachDayOfInterval({
    end: parseISO(endDay),
    start: parseISO(startDay),
  }).map((date) => format(date, "yyyy-MM-dd"));
}

function compareNullableTimes(left: string | null, right: string | null): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return new Date(left).getTime() - new Date(right).getTime();
}

export function compareItineraryItems(left: ItineraryListItem, right: ItineraryListItem): number {
  const dayDifference = getItemStartDay(left).localeCompare(getItemStartDay(right));

  if (dayDifference !== 0) {
    return dayDifference;
  }

  const timeDifference = compareNullableTimes(left.start_time, right.start_time);

  if (timeDifference !== 0) {
    return timeDifference;
  }

  const endTimeDifference = compareNullableTimes(left.end_time, right.end_time);

  if (endTimeDifference !== 0) {
    return endTimeDifference;
  }

  const sortOrderDifference = left.sort_order - right.sort_order;

  if (sortOrderDifference !== 0) {
    return sortOrderDifference;
  }

  return left.title.localeCompare(right.title);
}

export function sortItineraryItems(items: ItineraryListItem[]): ItineraryListItem[] {
  return [...items].sort(compareItineraryItems);
}

export function groupItineraryItemsByDay(items: ItineraryListItem[]): Map<string, ItineraryListItem[]> {
  const groups = new Map<string, ItineraryListItem[]>();

  for (const item of sortItineraryItems(items)) {
    for (const day of getItineraryItemDaySpan(item)) {
      const existingItems = groups.get(day);

      if (existingItems) {
        existingItems.push(item);
        continue;
      }

      groups.set(day, [item]);
    }
  }

  return groups;
}

function toItineraryListItem(
  item: Partial<ItineraryItem> & Pick<ItineraryItem, "day_date" | "id" | "item_type" | "sort_order" | "title">,
): ItineraryListItem {
  return {
    day_date: item.day_date,
    description: item.description ?? null,
    destination_latitude: item.destination_latitude ?? null,
    destination_longitude: item.destination_longitude ?? null,
    destination_name: item.destination_name ?? null,
    end_time: item.end_time ?? null,
    id: item.id,
    image_url: item.image_url ?? null,
    item_type: item.item_type,
    latitude: item.latitude ?? null,
    location_name: item.location_name ?? null,
    longitude: item.longitude ?? null,
    sort_order: item.sort_order,
    start_time: item.start_time ?? null,
    title: item.title,
  };
}

function getPayloadRecordId(record: unknown): string {
  if (typeof record !== "object" || record === null || !("id" in record)) {
    return "";
  }

  return typeof record.id === "string" ? record.id : "";
}

export function useItinerary({ enabled = true, initialItems = [], tripId }: UseItineraryOptions) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && initialItems.length === 0);
  const [itineraryItems, setItineraryItems] = useState<ItineraryListItem[]>(() =>
    sortItineraryItems(initialItems),
  );

  const upsertItineraryItem = useCallback((item: ItineraryListItem) => {
    setItineraryItems((current) =>
      sortItineraryItems([...current.filter((existingItem) => existingItem.id !== item.id), item]),
    );
  }, []);

  const removeItineraryItem = useCallback((itemId: string) => {
    setItineraryItems((current) => current.filter((item) => item.id !== itemId));
  }, []);

  useEffect(() => {
    setItineraryItems(sortItineraryItems(initialItems));
  }, [initialItems]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    const loadItems = async () => {
      setIsLoading(initialItems.length === 0);
      setError(null);

      const { data, error: itineraryError } = await supabase
        .from("itinerary_items")
        .select(
          "id, item_type, title, description, image_url, day_date, start_time, end_time, location_name, latitude, longitude, destination_name, destination_latitude, destination_longitude, sort_order",
        )
        .eq("trip_id", tripId);

      if (!isMounted) {
        return;
      }

      if (itineraryError) {
        setError(itineraryError.message);
        setIsLoading(false);
        return;
      }

      const nextItems = ((data ?? []) as ItineraryItem[]).map(toItineraryListItem);
      setItineraryItems(sortItineraryItems(nextItems));
      setIsLoading(false);
    };

    void loadItems();

    const channel = supabase
      .channel(`itinerary:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `trip_id=eq.${tripId}`,
          schema: "public",
          table: "itinerary_items",
        },
        (payload) => {
          if (!isMounted) {
            return;
          }

          switch (payload.eventType) {
            case "DELETE": {
              const deletedId = getPayloadRecordId(payload.old) || getPayloadRecordId(payload.new);

              if (!deletedId) {
                return;
              }

              removeItineraryItem(deletedId);
              return;
            }
            case "INSERT":
            case "UPDATE": {
              upsertItineraryItem(toItineraryListItem(payload.new as ItineraryItem));
              return;
            }
            default:
              return;
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [enabled, initialItems.length, removeItineraryItem, tripId, upsertItineraryItem]);

  const groupedByDay = useMemo(() => groupItineraryItemsByDay(itineraryItems), [itineraryItems]);

  return {
    error,
    groupedByDay,
    isLoading,
    itineraryItems,
    removeLocalItem: removeItineraryItem,
    upsertLocalItem: upsertItineraryItem,
  };
}
