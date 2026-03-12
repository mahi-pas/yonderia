"use client";

import { format } from "date-fns";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import type { AllEventCommentRow } from "@/hooks/useAllEventComments";

type AllCommentsViewProps = {
  comments: AllEventCommentRow[];
  error: string | null;
  itemById: Map<string, ItineraryListItem>;
  onEventClick: (item: ItineraryListItem) => void;
};

function CommentCard({
  row,
  eventTitle,
  onViewEvent,
}: {
  row: AllEventCommentRow;
  eventTitle: string;
  onViewEvent: () => void;
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
}: AllCommentsViewProps) {
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
      {comments.map((row) => {
        const item = itemById.get(row.itineraryItemId);
        const eventTitle = item?.title ?? "Event";
        return (
          <CommentCard
            key={row.comment.id}
            row={row}
            eventTitle={eventTitle}
            onViewEvent={() => item && onEventClick(item)}
          />
        );
      })}
    </div>
  );
}
