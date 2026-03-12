"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventComment } from "@/lib/types";
import type { EventCommentWithAuthor } from "./useEventComments";

export type AllEventCommentRow = {
  comment: EventCommentWithAuthor;
  itineraryItemId: string;
};

type UseAllEventCommentsOptions = {
  enabled?: boolean;
  itineraryItemIds: string[];
  tripId: string | null;
};

export function useAllEventComments({
  enabled = true,
  itineraryItemIds,
  tripId,
}: UseAllEventCommentsOptions): {
  comments: AllEventCommentRow[];
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [comments, setComments] = useState<AllEventCommentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!tripId || itineraryItemIds.length === 0) {
      setComments([]);
      setError(null);
      return;
    }

    const supabase = createClient();

    const { data: commentsData, error: commentsError } = await supabase
      .from("event_comments")
      .select("id, itinerary_item_id, user_id, content, gif_url, created_at, updated_at")
      .in("itinerary_item_id", itineraryItemIds)
      .order("created_at", { ascending: true });

    if (commentsError) {
      setError(commentsError.message);
      setComments([]);
      return;
    }

    const commentsRows = (commentsData ?? []) as (Pick<
      EventComment,
      "id" | "itinerary_item_id" | "user_id" | "content" | "gif_url" | "created_at" | "updated_at"
    > & { itinerary_item_id: string })[];

    if (commentsRows.length === 0) {
      setComments([]);
      setError(null);
      return;
    }

    const { data: participantsData } = await supabase
      .from("trip_participants")
      .select("user_id, nickname")
      .eq("trip_id", tripId);

    type ParticipantRow = { user_id: string; nickname: string | null };
    const nicknameByUser = new Map<string, string | null>();
    for (const p of (participantsData ?? []) as ParticipantRow[]) {
      nicknameByUser.set(p.user_id, p.nickname ?? null);
    }

    const userIds = [...new Set(commentsRows.map((c) => c.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds);

    type ProfileRow = { id: string; display_name: string | null; avatar_url: string | null };
    const profileByUser = new Map(
      ((profilesData ?? []) as ProfileRow[]).map((p) => [
        p.id,
        { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null },
      ]),
    );

    const withAuthor: AllEventCommentRow[] = commentsRows.map((c) => {
      const profile = profileByUser.get(c.user_id);
      return {
        comment: {
          ...c,
          author: {
            display_name: profile?.display_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            nickname: nicknameByUser.get(c.user_id) ?? null,
          },
        } as EventCommentWithAuthor,
        itineraryItemId: c.itinerary_item_id,
      };
    });

    setComments(withAuthor);
    setError(null);
  }, [tripId, itineraryItemIds]);

  useEffect(() => {
    if (!enabled || !tripId || itineraryItemIds.length === 0) {
      setComments([]);
      setError(null);
      return;
    }

    void fetchComments();

    const supabase = createClient();
    let isMounted = true;
    const channel = supabase
      .channel(`event_comments:all:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_comments",
        },
        () => {
          if (isMounted) void fetchComments();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [enabled, tripId, itineraryItemIds.join(","), fetchComments]);

  return {
    comments,
    error,
    refetch: fetchComments,
  };
}
