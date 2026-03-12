"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventComment } from "@/lib/types";

export type EventCommentWithAuthor = EventComment & {
  author: {
    display_name: string | null;
    avatar_url: string | null;
    nickname: string | null;
  };
};

type UseEventCommentsOptions = {
  enabled?: boolean;
  itineraryItemId: string | null;
  tripId: string | null;
};

export function useEventComments({
  enabled = true,
  itineraryItemId,
  tripId,
}: UseEventCommentsOptions) {
  const [comments, setComments] = useState<EventCommentWithAuthor[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!itineraryItemId || !tripId) return;
    const supabase = createClient();

    const { data: commentsData, error: commentsError } = await supabase
      .from("event_comments")
      .select("id, itinerary_item_id, user_id, content, gif_url, created_at, updated_at")
      .eq("itinerary_item_id", itineraryItemId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      setError(commentsError.message);
      setComments([]);
      return;
    }

    const { data: participantsData } = await supabase
      .from("trip_participants")
      .select("user_id, nickname")
      .eq("trip_id", tripId);

    const nicknameByUser = new Map<string, string | null>();
    for (const p of participantsData ?? []) {
      nicknameByUser.set(p.user_id, p.nickname ?? null);
    }

    const userIds = [...new Set((commentsData ?? []).map((c) => c.user_id))];
    if (userIds.length === 0) {
      setComments(
        (commentsData ?? []).map((c) => ({
          ...c,
          author: {
            display_name: null,
            avatar_url: null,
            nickname: nicknameByUser.get(c.user_id) ?? null,
          },
        })) as EventCommentWithAuthor[],
      );
      setError(null);
      return;
    }

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds);

    const profileByUser = new Map(
      (profilesData ?? []).map((p) => [
        p.id,
        { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null },
      ]),
    );

    const withAuthor: EventCommentWithAuthor[] = (commentsData ?? []).map((c) => {
      const profile = profileByUser.get(c.user_id);
      return {
        ...c,
        author: {
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          nickname: nicknameByUser.get(c.user_id) ?? null,
        },
      };
    });

    setComments(withAuthor);
    setError(null);
  }, [itineraryItemId, tripId]);

  useEffect(() => {
    if (!enabled || !itineraryItemId || !tripId) {
      setComments([]);
      setError(null);
      return;
    }

    void fetchComments();

    const supabase = createClient();
    let isMounted = true;

    const channel = supabase
      .channel(`event_comments:${itineraryItemId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `itinerary_item_id=eq.${itineraryItemId}`,
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
  }, [enabled, itineraryItemId, tripId, fetchComments]);

  const addComment = useCallback(
    async (content: string | null, gifUrl: string | null) => {
      if (!itineraryItemId || (!content && !gifUrl)) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const optimistic: EventCommentWithAuthor = {
        id: `opt-${Date.now()}`,
        itinerary_item_id: itineraryItemId,
        user_id: user.id,
        content,
        gif_url: gifUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: {
          display_name: null,
          avatar_url: null,
          nickname: null,
        },
      };

      setComments((prev) => [...prev, optimistic]);

      const { data: inserted, error: insertError } = await supabase
        .from("event_comments")
        .insert({
          itinerary_item_id: itineraryItemId,
          user_id: user.id,
          content: content || null,
          gif_url: gifUrl || null,
        })
        .select("id, itinerary_item_id, user_id, content, gif_url, created_at, updated_at")
        .single();

      if (insertError) {
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
        setError(insertError.message);
        throw insertError;
      }

      void fetchComments();
      setError(null);
    },
    [itineraryItemId, fetchComments],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      const supabase = createClient();
      const previous = [...comments];
      setComments((prev) => prev.filter((c) => c.id !== commentId));

      const { error: deleteError } = await supabase
        .from("event_comments")
        .delete()
        .eq("id", commentId);

      if (deleteError) {
        setComments(previous);
        setError(deleteError.message);
        throw deleteError;
      }
      setError(null);
    },
    [comments],
  );

  return {
    addComment,
    comments,
    deleteComment,
    error,
    refetch: fetchComments,
  };
}
