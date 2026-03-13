"use client";

import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import type { AllEventCommentRow } from "@/hooks/useAllEventComments";
import type { CommentReactionSummary, TripParticipantRole } from "@/lib/types";
import { useCommentReactions } from "@/hooks/useCommentReactions";
import { useMyEventRsvps } from "@/hooks/useMyEventRsvps";
import GifPicker from "@/components/ui/GifPicker";
import CommentReactions from "./CommentReactions";

export type CommentsSortBy = "newest" | "oldest" | "most_reactions";

const MAX_LENGTH = 500;

type AllCommentsViewProps = {
  addAnnouncement?: (content: string | null, gifUrl: string | null) => Promise<void>;
  addTripComment?: (content: string | null, gifUrl: string | null) => Promise<void>;
  comments: AllEventCommentRow[];
  currentUserId: string | null;
  error: string | null;
  itemById: Map<string, ItineraryListItem>;
  onEventClick: (item: ItineraryListItem) => void;
  tripId: string | null;
  userRole?: TripParticipantRole | null;
};

function AnnouncementCard({
  row,
  reactions,
  currentUserId,
  onAddReaction,
  onRemoveReaction,
}: {
  row: AllEventCommentRow;
  reactions: CommentReactionSummary[];
  currentUserId: string | null;
  onAddReaction: (commentId: string, emoji: string) => void;
  onRemoveReaction: (commentId: string, emoji: string) => void;
}) {
  const { comment } = row;
  const authorName = comment.author.nickname || comment.author.display_name || "Someone";

  return (
    <article
      className="rounded-xl border-2 border-[#8b5cf6]/50 bg-gradient-to-br from-[#8b5cf6]/15 to-[#a78bfa]/10 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(139,92,246,0.12)] backdrop-blur-sm sm:p-4"
      aria-label="Announcement"
    >
      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] sm:gap-3">
        <span className="inline-flex items-center gap-1 rounded bg-[#8b5cf6]/30 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-[#a78bfa]">
          📢 Announcement
        </span>
        <span>{authorName}</span>
        <span>{format(new Date(comment.created_at), "MMM d, h:mm a")}</span>
      </div>
      <div className="mt-2 flex gap-2 sm:mt-3 sm:gap-3">
        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[var(--surface-elevated)] sm:h-8 sm:w-8">
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
          {comment.content ? (
            <p className="whitespace-pre-wrap break-words text-sm font-medium text-[#e4e4e7] sm:text-[15px]">
              {comment.content}
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
    </article>
  );
}

function CommentCard({
  row,
  eventTitle,
  isTripLevel,
  reactions,
  currentUserId,
  onViewEvent,
  onAddReaction,
  onRemoveReaction,
}: {
  row: AllEventCommentRow;
  eventTitle: string;
  isTripLevel: boolean;
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
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15)] backdrop-blur-sm sm:p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)] sm:gap-x-3">
        {isTripLevel ? (
          <span className="rounded font-semibold text-[#a78bfa]">Trip</span>
        ) : (
          <button
            type="button"
            onClick={onViewEvent}
            className="rounded font-semibold text-[#a78bfa] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
          >
            {eventTitle}
          </button>
        )}
        <span aria-hidden className="hidden sm:inline text-[var(--border-strong)]">·</span>
        <span>{authorName}</span>
        <span>{format(new Date(comment.created_at), "MMM d, h:mm a")}</span>
      </div>
      <div className="mt-2 flex gap-2 sm:mt-3 sm:gap-3">
        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[var(--surface-elevated)] sm:h-8 sm:w-8">
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
      {!isTripLevel ? (
        <div className="mt-2 flex justify-end sm:mt-3">
          <button
            type="button"
            onClick={onViewEvent}
            className="rounded text-xs font-medium text-[#a78bfa] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
          >
            View event
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default function AllCommentsView({
  addAnnouncement,
  addTripComment,
  comments,
  error,
  itemById,
  onEventClick,
  currentUserId,
  tripId,
  userRole = null,
}: AllCommentsViewProps) {
  const [sortBy, setSortBy] = useState<CommentsSortBy>("newest");
  const [filterByGoingOnly, setFilterByGoingOnly] = useState(false);
  const [tripDraft, setTripDraft] = useState("");
  const [pendingGif, setPendingGif] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [sendAsAnnouncement, setSendAsAnnouncement] = useState(false);

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

  const canSendAnnouncement = userRole === "organizer" || userRole === "planner";
  const hasContent = tripDraft.trim().length > 0 || pendingGif !== null;
  const lengthOk = tripDraft.length <= MAX_LENGTH;
  const canSend =
    hasContent &&
    lengthOk &&
    (sendAsAnnouncement ? addAnnouncement && canSendAnnouncement : addTripComment);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const content = tripDraft.trim() || null;
    const gifUrl = pendingGif;

    if (sendAsAnnouncement && addAnnouncement && canSendAnnouncement) {
      const confirmed = typeof window !== "undefined" && window.confirm("Are you sure you want to send this as an announcement?");
      if (!confirmed) return;
      setTripDraft("");
      setPendingGif(null);
      void addAnnouncement(content, gifUrl);
    } else if (addTripComment) {
      setTripDraft("");
      setPendingGif(null);
      void addTripComment(content, gifUrl);
    }
  }, [canSend, tripDraft, pendingGif, sendAsAnnouncement, canSendAnnouncement, addAnnouncement, addTripComment]);

  const displayedComments = useMemo(() => {
    let list = comments;
    if (filterByGoingOnly && currentUserId) {
      list = list.filter(
        (row) => row.itineraryItemId === null || myRsvpByItemId.get(row.itineraryItemId) === "going",
      );
    }
    const announcements = list.filter((r) => r.comment.is_announcement);
    const latestAnnouncement =
      announcements.length > 0
        ? announcements.reduce((a, b) =>
            new Date(b.comment.created_at) > new Date(a.comment.created_at) ? b : a,
          )
        : null;
    const rest = list.filter((r) => r.comment.id !== latestAnnouncement?.comment.id);
    const getReactionCount = (commentId: string) =>
      (reactionsByCommentId.get(commentId) ?? []).reduce((s, r) => s + r.count, 0);
    const sortedRest = [...rest].sort((a, b) => {
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
    return latestAnnouncement ? [latestAnnouncement, ...sortedRest] : sortedRest;
  }, [comments, filterByGoingOnly, currentUserId, myRsvpByItemId, sortBy, reactionsByCommentId]);

  if (error) {
    return (
      <div className="rounded-xl border border-[#ef4444]/30 bg-[#450a0a]/90 px-4 py-3 text-sm text-[#fca5a5]">
        {error}
      </div>
    );
  }

  const showEmptyState = comments.length === 0;
  const showComposer = !!currentUserId && (addTripComment || (addAnnouncement && canSendAnnouncement));

  return (
    <div className="space-y-3 sm:space-y-4">
      {showComposer ? (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15)] backdrop-blur-sm sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide gradient-text">
            Comment on the trip
          </p>
          <div className="flex max-w-md gap-2 md:max-w-xl lg:max-w-2xl">
            <textarea
              placeholder="Comment on this trip..."
              value={tripDraft}
              onChange={(e) => setTripDraft(e.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              className="min-h-10 max-h-40 flex-1 resize-none overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm leading-5 text-[#fafafa] placeholder:text-[var(--muted-foreground)] focus:border-[#8b5cf6] focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20"
            />
            <button
              type="button"
              aria-label="Add GIF"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--surface)] hover:text-[#d4d4d8] focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20"
              onClick={() => setShowGifPicker(true)}
            >
              GIF
            </button>
            <button
              type="button"
              disabled={!canSend}
              aria-label="Send comment"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[image:var(--accent-gradient)] text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30"
              onClick={handleSend}
            >
              ➤
            </button>
          </div>
          {pendingGif ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingGif}
                alt="Selected GIF"
                className="h-14 w-14 rounded object-cover"
              />
              <span className="text-xs text-[var(--muted-foreground)]">GIF added</span>
              <button
                type="button"
                className="text-xs text-[#a78bfa] underline"
                onClick={() => setPendingGif(null)}
              >
                Remove
              </button>
            </div>
          ) : null}
          {tripDraft.length > MAX_LENGTH * 0.9 ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              {tripDraft.length}/{MAX_LENGTH}
            </p>
          ) : null}
          {addAnnouncement && canSendAnnouncement ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={sendAsAnnouncement}
                onChange={(e) => setSendAsAnnouncement(e.target.checked)}
                aria-label="Send as announcement (pinned at top)"
              />
              <span>Send as announcement</span>
            </label>
          ) : null}
          <GifPicker
            isOpen={showGifPicker}
            onClose={() => setShowGifPicker(false)}
            onSelect={(gifUrl) => {
              setPendingGif(gifUrl);
              setShowGifPicker(false);
            }}
          />
        </div>
      ) : null}

      {comments.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-2 shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15)] backdrop-blur-sm sm:p-3">
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
                aria-label="Only show comments from events I'm going to"
              />
              <span>Events I&apos;m going to</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {showEmptyState ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)]/80 px-4 py-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15)] backdrop-blur-sm sm:py-12">
          <p className="text-sm text-[var(--muted-foreground)]">
            No comments yet. Add one above or open an event to comment there!
          </p>
        </div>
      ) : displayedComments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)]/80 px-4 py-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15)] backdrop-blur-sm sm:py-12">
          <p className="text-sm text-[var(--muted-foreground)]">
            {filterByGoingOnly
              ? "No comments in events you&apos;re going to."
              : "No comments yet. Open an event and start the conversation!"}
          </p>
        </div>
      ) : (
        displayedComments.map((row) => {
          if (row.comment.is_announcement) {
            return (
              <AnnouncementCard
                key={row.comment.id}
                row={row}
                reactions={reactionsByCommentId.get(row.comment.id) ?? []}
                currentUserId={currentUserId}
                onAddReaction={addReaction}
                onRemoveReaction={removeReaction}
              />
            );
          }
          const item = row.itineraryItemId ? itemById.get(row.itineraryItemId) : null;
          const eventTitle = item?.title ?? "Event";
          const isTripLevel = row.itineraryItemId === null;
          return (
            <CommentCard
              key={row.comment.id}
              row={row}
              eventTitle={eventTitle}
              isTripLevel={isTripLevel}
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
