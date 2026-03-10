import type { ItineraryItem } from "@/lib/types";

export function useItinerary() {
  return {
    itineraryItems: [] as ItineraryItem[],
    isLoading: false,
    error: null as string | null,
  };
}
