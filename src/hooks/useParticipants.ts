import type { TripParticipant } from "@/lib/types";

export function useParticipants() {
  return {
    participants: [] as TripParticipant[],
    isLoading: false,
    error: null as string | null,
  };
}
