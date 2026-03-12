"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import type { AllEventCommentRow } from "@/hooks/useAllEventComments";
import type { CommentReactionSummary } from "@/lib/types";
import { useCommentReactions } from "@/hooks/useCommentReactions";
import { useMyEventRsvps } from "@/hooks/useMyEventRsvps";
import CommentReactions from "./CommentReactions";

export type CommentsSortBy = "newest" | "oldest" | "most_reactions";

type AllCommentsViewProps = {
  comments: AllEventCommentRow[];
  currentUserId: string | null;
  error: string | null;
  itemById: Map<string, ItineraryListItem>;
  onEventClick: (item: ItineraryListItem) => void;
  tripId: string | null;
};

function CommentCard({
  row,
  eventTitle,
  reactions,
  currentUserId,
  onViewEvent,
  onAddReaction,
  onRemoveReaction,
}: {
  row: AllEventCommentRow;
  eventTitle: string;
  reactions: CommentReactionSummary[];
  currentUserId: string | null;
  onViewEvent: () => void;
  onAddReaction: (commentId: string, emoji: string) => void;
  onRemoveReaction: (commentId: string, emoji: string) => void;
}) {
  const { comment } = row;
  const authorName = comment.author.nickname || comment.author.display_name || "Someone";
  const contentPreview = comment.content?.slice(0, 200) ?? "";
  const hasMore = (comment.content?.length ?? 0) > 200;

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)] sm:gap-x-3">
        <button
          type="button"
          onClick={onViewEvent}
          className="font-semibold text-[#a78bfa] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 focus:ring-offset-2 focus:ring-offset-[var(--surface-elevated)] rounded"
        >
          {eventTitle}
        </button>
        <span aria-hidden className="hidden sm:inline text-[var(--border-strong)]">·</span>
        <span>{authorName}</span>
        <span>{format(new Date(comment.created_at), "MMM d, h:mm a")}</span>
      </div>
      <div className="mt-2 flex gap-2 sm:mt-3 sm:gap-3">
        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[var(--surface)] sm:h-8 sm:w-8">
          {comment.author.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={comment.author.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--muted-foreground)] sm:text-xs">
              {authorName[0]}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {contentPreview ? (
            <p className="whitespace-pre-wrap break-words text-sm text-[#d4d4d8] sm:text-[15px]">
              {contentPreview}
              {hasMore ? "…" : ""}
            </p>
          ) : null}
          {comment.gif_url ? (
            <div className="mt-1.5 sm:mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={comment.gif_url}
                alt="GIF"
                className="max-h-28 max-w-full rounded-lg object-contain sm:max-h-36"
              />
            </div>
          ) : null}
          <CommentReactions
            canAdd={!!currentUserId}
            commentId={comment.id}
            currentUserId={currentUserId}
            onAddReaction={onAddReaction}
            onRemoveReaction={onRemoveReaction}
            reactions={reactions}
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end sm:mt-3">
        <button
          type="button"
          onClick={onViewEvent}
          className="text-xs font-medium text-[#a78bfa] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 focus:ring-offset-2 focus:ring-offset-[var(--surface-elevated)] rounded"
        >
          View event
        </button>
      </div>
    </article>
  );
}

export default function AllCommentsView({
  comments,
  error,
  itemById,
  onEventClick,
  currentUserId,
  tripId,
}: AllCommentsViewProps) {
  const [sortBy, setSortBy] = useState<CommentsSortBy>("newest");
  const [filterByGoingOnly, setFilterByGoingOnly] = useState(false);

  const itineraryItemIds = useMemo(() => Array.from(itemById.keys()), [itemById]);
  const myRsvpByItemId = useMyEventRsvps({
    currentUserId,
    enabled: !!currentUserId && itineraryItemIds.length > 0,
    itineraryItemIds,
  });

  const commentIds = useMemo(() => comments.map((r) => r.comment.id), [comments]);
  const {
    addReaction,
    reactionsByCommentId,
    removeReaction,
  } = useCommentReactions({
    commentIds,
    enabled: comments.length > 0,
    tripId,
  });

  const displayedComments = useMemo(() => {
    let list = comments;
    if (filterByGoingOnly && currentUserId) {
      list = list.filter((row) => myRsvpByItemId.get(row.itineraryItemId) === "going");
    }
    const getReactionCount = (commentId: string) =>
      (reactionsByCommentId.get(commentId) ?? []).reduce((s, r) => s + r.count, 0);
    return [...list].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime();
      }
      const ra = getReactionCount(a.comment.id);
      const rb = getReactionCount(b.comment.id);
      if (rb !== ra) return rb - ra;
      return new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime();
    });
  }, [comments, filterByGoingOnly, currentUserId, myRsvpByItemId, sortBy, reactionsByCommentId]);

  if (error) {
    return (
      <div className="rounded-xl border border-[#ef4444]/30 bg-[#450a0a]/90 px-4 py-3 text-sm text-[#fca5a5]">
        {error}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 py-8 text-center sm:py-12">
        <p className="text-sm text-[var(--muted-foreground)]">
          No comments yet. Open an event and start the conversation!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2 sm:p-3">
        <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span className="shrink-0">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CommentsSortBy)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[#fafafa] focus:border-[#8b5cf6] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]"
            aria-label="Sort comments by"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most_reactions">Most reactions</option>
          </select>
        </label>
        {currentUserId ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={filterByGoingOnly}
              onChange={(e) => setFilterByGoingOnly(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] bg-[var(--surface)] text-[#8b5cf6] focus:ring-[#8b5cf6]"
              aria-label="Only show comments from events I'm going to"
            />
            <span>Events I&apos;m going to</span>
          </label>
        ) : null}
      </div>

      {displayedComments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 py-8 text-center sm:py-12">
          <p className="text-sm text-[var(--muted-foreground)]">
            {filterByGoingOnly
              ? "No comments in events you&apos;re going to."
              : "No comments yet. Open an event and start the conversation!"}
          </p>
        </div>
      ) : (
        displayedComments.map((row) => {
          const item = itemById.get(row.itineraryItemId);
          const eventTitle = item?.title ?? "Event";
          return (
            <CommentCard
              key={row.comment.id}
              row={row}
              eventTitle={eventTitle}
              reactions={reactionsByCommentId.get(row.comment.id) ?? []}
              currentUserId={currentUserId}
              onViewEvent={() => item && onEventClick(item)}
              onAddReaction={addReaction}
              onRemoveReaction={removeReaction}
            />
          );
        })
      )}
    </div>
  );
}
