import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TripParticipant } from "@/lib/types";

export type ParticipantListItem = {
  avatarUrl: string | null;
  id?: string;
  name: string;
  profilePath: string | null;
  role: TripParticipant["role"];
  userId?: string;
};

type ParticipantRow = Pick<TripParticipant, "id" | "nickname" | "role" | "user_id"> & {
  profile:
    | Pick<Profile, "avatar_url" | "display_name" | "id">
    | Array<Pick<Profile, "avatar_url" | "display_name" | "id">>
    | null;
};

type UseParticipantsOptions = {
  enabled?: boolean;
  initialParticipants?: ParticipantListItem[];
  tripId: string;
};

const ROLE_RANK = {
  organizer: 0,
  planner: 1,
  member: 2,
} as const;

function compareParticipants(left: ParticipantListItem, right: ParticipantListItem): number {
  const roleDifference = ROLE_RANK[left.role] - ROLE_RANK[right.role];

  if (roleDifference !== 0) {
    return roleDifference;
  }

  return left.name.localeCompare(right.name);
}

function sortParticipants(participants: ParticipantListItem[]): ParticipantListItem[] {
  return [...participants].sort(compareParticipants);
}

function resolveProfile(
  profile: ParticipantRow["profile"],
): Pick<Profile, "avatar_url" | "display_name" | "id"> | null {
  if (Array.isArray(profile)) {
    return profile[0] ?? null;
  }

  return profile;
}

function toParticipantListItem(row: ParticipantRow): ParticipantListItem {
  const profile = resolveProfile(row.profile);
  const nickname = row.nickname?.trim();
  const displayName = profile?.display_name?.trim();

  return {
    avatarUrl: profile?.avatar_url ?? null,
    id: row.id,
    name: nickname || displayName || "Traveler",
    profilePath: `/profile/${row.user_id}`,
    role: row.role,
    userId: row.user_id,
  };
}

function getPayloadRecordId(record: unknown): string {
  if (typeof record !== "object" || record === null || !("id" in record)) {
    return "";
  }

  return typeof record.id === "string" ? record.id : "";
}

export function useParticipants({
  enabled = true,
  initialParticipants = [],
  tripId,
}: UseParticipantsOptions) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled && initialParticipants.length === 0);
  const [participants, setParticipants] = useState<ParticipantListItem[]>(() =>
    sortParticipants(initialParticipants),
  );

  useEffect(() => {
    setParticipants(sortParticipants(initialParticipants));
  }, [initialParticipants]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    const participantSelect = `
      id,
      nickname,
      role,
      user_id,
      profile:profiles!trip_participants_user_id_fkey (
        id,
        display_name,
        avatar_url
      )
    `;

    const loadParticipants = async () => {
      setError(null);
      setIsLoading(initialParticipants.length === 0);

      const { data, error: participantsError } = await supabase
        .from("trip_participants")
        .select(participantSelect)
        .eq("trip_id", tripId);

      if (!isMounted) {
        return;
      }

      if (participantsError) {
        setError(participantsError.message);
        setIsLoading(false);
        return;
      }

      const nextParticipants = ((data ?? []) as ParticipantRow[]).map(toParticipantListItem);
      setParticipants(sortParticipants(nextParticipants));
      setIsLoading(false);
    };

    const loadParticipant = async (participantId: string) => {
      const { data, error: participantError } = await supabase
        .from("trip_participants")
        .select(participantSelect)
        .eq("id", participantId)
        .maybeSingle();

      if (!isMounted || participantError || !data) {
        return;
      }

      const nextParticipant = toParticipantListItem(data as ParticipantRow);
      setParticipants((current) =>
        sortParticipants([...current.filter((participant) => participant.id !== nextParticipant.id), nextParticipant]),
      );
    };

    void loadParticipants();

    const channel = supabase
      .channel(`participants:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `trip_id=eq.${tripId}`,
          schema: "public",
          table: "trip_participants",
        },
        (payload) => {
          if (!isMounted) {
            return;
          }

          if (payload.eventType === "DELETE") {
            const deletedId = getPayloadRecordId(payload.old) || getPayloadRecordId(payload.new);

            if (!deletedId) {
              return;
            }

            setParticipants((current) => current.filter((participant) => participant.id !== deletedId));
            return;
          }

          const participantId = getPayloadRecordId(payload.new) || getPayloadRecordId(payload.old);

          if (!participantId) {
            return;
          }

          void loadParticipant(participantId);
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [enabled, initialParticipants.length, tripId]);

  return {
    error,
    isLoading,
    participants,
  };
}
