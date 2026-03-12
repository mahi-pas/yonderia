"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CommentReactionSummary } from "@/lib/types";

type UseCommentReactionsOptions = {
  commentIds: string[];
  enabled?: boolean;
  tripId: string | null;
};

export function useCommentReactions({
  commentIds,
  enabled = true,
  tripId,
}: UseCommentReactionsOptions): {
  addReaction: (commentId: string, emoji: string) => Promise<void>;
  reactionsByCommentId: Map<string, CommentReactionSummary[]>;
  removeReaction: (commentId: string, emoji: string) => Promise<void>;
} {
  const [reactionsByCommentId, setReactionsByCommentId] = useState<
    Map<string, CommentReactionSummary[]>
  >(new Map());

  const fetchReactions = useCallback(async () => {
    if (commentIds.length === 0) {
      setReactionsByCommentId(new Map());
      return;
    }

    const supabase = createClient();

    const { data: rows, error } = await supabase
      .from("event_comment_reactions")
      .select("id, comment_id, user_id, emoji")
      .in("comment_id", commentIds);

    if (error) {
      setReactionsByCommentId(new Map());
      return;
    }

    type Row = { id: string; comment_id: string; user_id: string; emoji: string };
    const reactions = (rows ?? []) as Row[];
    const userIds = [...new Set(reactions.map((r) => r.user_id))];

    if (userIds.length === 0) {
      const byComment = new Map<string, CommentReactionSummary[]>();
      for (const id of commentIds) byComment.set(id, []);
      setReactionsByCommentId(byComment);
      return;
    }

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    type ProfileRow = { id: string; display_name: string | null };
    const profileByUser = new Map(
      ((profilesData ?? []) as ProfileRow[]).map((p) => [
        p.id,
        { display_name: p.display_name ?? null },
      ]),
    );

    type ParticipantRow = { user_id: string; nickname: string | null };
    let participantsData: ParticipantRow[] = [];
    if (tripId) {
      const { data } = await supabase
        .from("trip_participants")
        .select("user_id, nickname")
        .eq("trip_id", tripId)
        .in("user_id", userIds);
      participantsData = (data ?? []) as ParticipantRow[];
    }
    const nicknameByUser = new Map(
      participantsData.map((p) => [p.user_id, p.nickname ?? null]),
    );

    const byComment = new Map<string, CommentReactionSummary[]>();
    for (const id of commentIds) byComment.set(id, []);

    const byCommentEmoji = new Map<
      string,
      Map<string, { userIds: Set<string>; reactors: CommentReactionSummary["reactors"] }>
    >();
    for (const r of reactions) {
      let emojiMap = byCommentEmoji.get(r.comment_id);
      if (!emojiMap) {
        emojiMap = new Map();
        byCommentEmoji.set(r.comment_id, emojiMap);
      }
      let entry = emojiMap.get(r.emoji);
      if (!entry) {
        entry = { userIds: new Set(), reactors: [] };
        emojiMap.set(r.emoji, entry);
      }
      if (!entry.userIds.has(r.user_id)) {
        entry.userIds.add(r.user_id);
        entry.reactors.push({
          user_id: r.user_id,
          display_name: profileByUser.get(r.user_id)?.display_name ?? null,
          nickname: nicknameByUser.get(r.user_id) ?? null,
        });
      }
    }

    for (const [commentId, emojiMap] of byCommentEmoji) {
      const list: CommentReactionSummary[] = [];
      for (const [emoji, { reactors }] of emojiMap) {
        list.push({ emoji, count: reactors.length, reactors });
      }
      list.sort((a, b) => b.count - a.count);
      byComment.set(commentId, list);
    }

    setReactionsByCommentId(byComment);
  }, [commentIds, tripId]);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => setReactionsByCommentId(new Map()));
      return;
    }
    queueMicrotask(() => void fetchReactions());

    const supabase = createClient();
    let isMounted = true;
    const channel = supabase
      .channel("event_comment_reactions:changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_comment_reactions",
        },
        () => {
          if (isMounted) void fetchReactions();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [enabled, fetchReactions]);

  const addReaction = useCallback(
    async (commentId: string, emoji: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("event_comment_reactions").insert({
        comment_id: commentId,
        user_id: user.id,
        emoji: emoji.slice(0, 10),
      } as never);
      void fetchReactions();
    },
    [fetchReactions],
  );

  const removeReaction = useCallback(
    async (commentId: string, emoji: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("event_comment_reactions")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
      void fetchReactions();
    },
    [fetchReactions],
  );

  return {
    addReaction,
    reactionsByCommentId,
    removeReaction,
  };
}
