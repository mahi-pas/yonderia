"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SmilePlus } from "lucide-react";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import type { CommentReactionSummary } from "@/lib/types";

const LONG_PRESS_MS = 500;

type CommentReactionsProps = {
  canAdd: boolean;
  commentId: string;
  currentUserId: string | null;
  onAddReaction: (commentId: string, emoji: string) => void;
  onRemoveReaction: (commentId: string, emoji: string) => void;
  reactions: CommentReactionSummary[];
};

function formatReactors(summary: CommentReactionSummary): string {
  const names = summary.reactors.map(
    (r) => r.nickname || r.display_name || "Someone",
  );
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} reacted with ${summary.emoji}`;
  if (names.length === 2) return `${names[0]} and ${names[1]} reacted with ${summary.emoji}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} reacted with ${summary.emoji}`;
}

function hasUserReacted(
  summary: CommentReactionSummary,
  userId: string | null,
): boolean {
  if (!userId) return false;
  return summary.reactors.some((r) => r.user_id === userId);
}

export default function CommentReactions({
  canAdd,
  commentId,
  currentUserId,
  onAddReaction,
  onRemoveReaction,
  reactions,
}: CommentReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [stickyPreview, setStickyPreview] = useState<{ emoji: string } | null>(
    null,
  );
  const pickerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressHandledRef = useRef(false);
  const previewPopoverRef = useRef<HTMLDivElement | null>(null);

  const handlePillClick = useCallback(
    (summary: CommentReactionSummary) => {
      if (longPressHandledRef.current) {
        longPressHandledRef.current = false;
        return;
      }
      if (!canAdd) return;
      const isOwn = hasUserReacted(summary, currentUserId);
      if (isOwn) onRemoveReaction(commentId, summary.emoji);
      else onAddReaction(commentId, summary.emoji);
    },
    [canAdd, commentId, currentUserId, onAddReaction, onRemoveReaction],
  );

  const showWhoReacted = useCallback((summary: CommentReactionSummary) => {
    setStickyPreview({ emoji: summary.emoji });
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePillTouchStart = useCallback(
    (summary: CommentReactionSummary) => {
      clearLongPressTimer();
      longPressHandledRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        longPressHandledRef.current = true;
        showWhoReacted(summary);
      }, LONG_PRESS_MS);
    },
    [clearLongPressTimer, showWhoReacted],
  );

  const handlePillTouchEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handlePillContextMenu = useCallback(
    (e: React.MouseEvent, summary: CommentReactionSummary) => {
      e.preventDefault();
      showWhoReacted(summary);
    },
    [showWhoReacted],
  );

  const handleEmojiPick = useCallback(
    (data: EmojiClickData) => {
      const emoji = data.emoji;
      if (!emoji) return;
      onAddReaction(commentId, emoji.slice(0, 10));
      setShowPicker(false);
    },
    [commentId, onAddReaction],
  );

  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current?.contains(e.target as Node)) return;
      const target = e.target as HTMLElement;
      if (
        target?.closest?.("[data-reaction-pill]") ||
        target?.closest?.("[data-emoji-picker]")
      )
        return;
      setShowPicker(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  useEffect(() => {
    return () => clearLongPressTimer();
  }, [clearLongPressTimer]);

  useEffect(() => {
    if (!stickyPreview) return;
    const dismiss = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (
        (e.target as HTMLElement)?.closest?.("[data-reaction-pill]") ||
        (e.target as HTMLElement)?.closest?.("[data-reaction-preview]")
      )
        return;
      setStickyPreview(null);
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("touchstart", dismiss, { passive: true });
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("touchstart", dismiss);
    };
  }, [stickyPreview]);

  if (reactions.length === 0 && !canAdd) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {reactions.map((summary) => {
        const isOwn = hasUserReacted(summary, currentUserId);
        const label = formatReactors(summary);
        return (
          <div key={summary.emoji} className="relative inline-flex">
            <button
              type="button"
              data-reaction-pill
              aria-label={
                canAdd
                  ? isOwn
                    ? `Remove your ${summary.emoji} reaction. ${label}`
                    : `Add ${summary.emoji} reaction. ${label}`
                  : label || `${summary.emoji} ${summary.count}`
              }
              title={label || undefined}
              className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 ${
                isOwn
                  ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/20 text-[#fafafa]"
                  : "border-[var(--border)] bg-[var(--surface-elevated)] text-[#d4d4d8] hover:border-[var(--border-strong)]"
              } ${canAdd ? "cursor-pointer" : "cursor-default"}`}
              onClick={() => canAdd && handlePillClick(summary)}
              onContextMenu={(e) => handlePillContextMenu(e, summary)}
              onTouchStart={() => handlePillTouchStart(summary)}
              onTouchEnd={handlePillTouchEnd}
              onTouchCancel={handlePillTouchEnd}
            >
              <span aria-hidden>{summary.emoji}</span>
              <span className="tabular-nums">{summary.count}</span>
            </button>
            {stickyPreview?.emoji === summary.emoji && label ? (
              <div
                ref={
                  stickyPreview?.emoji === summary.emoji
                    ? (el) => {
                        previewPopoverRef.current = el;
                      }
                    : undefined
                }
                data-reaction-preview
                className="absolute bottom-full left-0 z-10 mb-1 max-w-[220px] rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 shadow-lg pointer-events-auto"
                role="tooltip"
              >
                <p className="text-xs text-[#d4d4d8]">{label}</p>
              </div>
            ) : null}
          </div>
        );
      })}
      {canAdd ? (
        <div className="relative inline-flex" ref={pickerRef}>
          <button
            type="button"
            data-emoji-picker
            aria-label="Add reaction"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)] transition hover:border-[var(--border-strong)] hover:text-[#d4d4d8] focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30"
            onClick={() => setShowPicker((v) => !v)}
          >
            <SmilePlus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
          {showPicker ? (
            <div
              data-emoji-picker
              className="absolute bottom-full left-0 z-20 mb-1"
            >
              <EmojiPicker
                onEmojiClick={handleEmojiPick}
                theme={Theme.DARK}
                width={320}
                height={400}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
