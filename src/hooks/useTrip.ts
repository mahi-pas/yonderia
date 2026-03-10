import type { Trip } from "@/lib/types";

export function useTrip() {
  return {
    trip: null as Trip | null,
    isLoading: false,
    error: null as string | null,
  };
}
