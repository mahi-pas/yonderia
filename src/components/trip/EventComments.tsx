"use client";

import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import type { CommentReactionSummary, TripParticipantRole } from "@/lib/types";
import type { EventCommentWithAuthor } from "@/hooks/useEventComments";
import { useEventComments } from "@/hooks/useEventComments";
import { useCommentReactions } from "@/hooks/useCommentReactions";
import CommentReactions from "./CommentReactions";
import GifPicker from "@/components/ui/GifPicker";

const MAX_LENGTH = 500;

type EventCommentsProps = {
  currentUserId: string | null;
  fullView?: boolean;
  itineraryItemId: string;
  tripId: string;
  userRole: TripParticipantRole | null;
};

function CommentRow({
  comment,
  currentUserId,
  reactions,
  userRole,
  onAddReaction,
  onDelete,
  onRemoveReaction,
}: {
  comment: EventCommentWithAuthor;
  currentUserId: string | null;
  reactions: CommentReactionSummary[];
  userRole: TripParticipantRole | null;
  onAddReaction: (commentId: string, emoji: string) => void;
  onDelete: (id: string) => void;
  onRemoveReaction: (commentId: string, emoji: string) => void;
}) {
  const isOwn = currentUserId === comment.user_id;
  const canDelete = isOwn || userRole === "organizer";

  return (
    <div className="group flex gap-3 py-2">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
        {comment.author.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.author.avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted-foreground)]">
            {(comment.author.nickname || comment.author.display_name || "?")[0]}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#fafafa]">
            {comment.author.nickname || comment.author.display_name || "Someone"}
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            {format(new Date(comment.created_at), "MMM d, h:mm a")}
          </span>
          {canDelete ? (
            <button
              type="button"
              aria-label="Delete comment"
              className="ml-auto opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              onClick={() => onDelete(comment.id)}
            >
              <span className="text-[var(--muted-foreground)] hover:text-[#f87171]" aria-hidden>🗑</span>
            </button>
          ) : null}
        </div>
        {comment.content ? (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[#d4d4d8]">
            {comment.content}
          </p>
        ) : null}
        {comment.gif_url ? (
          <div className="mt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={comment.gif_url}
              alt="GIF"
              className="max-h-40 max-w-full rounded-lg object-contain"
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
  );
}

export default function EventComments({
  currentUserId,
  fullView = false,
  itineraryItemId,
  tripId,
  userRole,
}: EventCommentsProps) {
  const [draft, setDraft] = useState("");
  const [pendingGif, setPendingGif] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const { addComment, comments, deleteComment, error } = useEventComments({
    itineraryItemId,
    tripId,
  });
  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const {
    addReaction,
    reactionsByCommentId,
    removeReaction,
  } = useCommentReactions({
    commentIds,
    tripId,
  });

  const canSend = (draft.trim().length > 0 || pendingGif !== null) && draft.length <= MAX_LENGTH;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const content = draft.trim() || null;
    const gifUrl = pendingGif;
    setDraft("");
    setPendingGif(null);
    void addComment(content, gifUrl);
  }, [canSend, draft, pendingGif, addComment]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleGifSelect = useCallback((gifUrl: string) => {
    setPendingGif(gifUrl);
    setShowGifPicker(false);
  }, []);

  const commentList = (
    <>
      {error ? (
        <p className="px-1 py-2 text-sm text-[#f87171]">{error}</p>
      ) : null}
      {comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
          No comments yet — start the conversation!
        </p>
      ) : (
        comments.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            currentUserId={currentUserId}
            reactions={reactionsByCommentId.get(c.id) ?? []}
            userRole={userRole}
            onAddReaction={addReaction}
            onDelete={deleteComment}
            onRemoveReaction={removeReaction}
          />
        ))
      )}
    </>
  );

  const addCommentArea = (
    <>
      <div className="flex max-w-md gap-2">
        <textarea
          placeholder="Add a comment..."
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          rows={1}
          className="min-h-9 max-h-24 flex-1 resize-none rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[#fafafa] placeholder:text-[var(--muted-foreground)] focus:border-[#8b5cf6] focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20"
        />
        <button
          type="button"
          aria-label="Add GIF"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--surface)] hover:text-[#d4d4d8] focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20"
          onClick={() => setShowGifPicker(true)}
        >
          GIF
        </button>
        <button
          type="button"
          disabled={!canSend}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[image:var(--accent-gradient)] text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30"
          onClick={handleSend}
          aria-label="Send comment"
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
      {draft.length > MAX_LENGTH * 0.9 ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {draft.length}/{MAX_LENGTH}
        </p>
      ) : null}
    </>
  );

  if (fullView) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {commentList}
        </div>
        <div className="shrink-0 space-y-2 border-t border-[var(--border)] pt-4">
          {addCommentArea}
        </div>
        <GifPicker
          isOpen={showGifPicker}
          onClose={() => setShowGifPicker(false)}
          onSelect={handleGifSelect}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide gradient-text">
        Comments
      </p>
      <div className="max-h-64 min-h-[6rem] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
        {commentList}
      </div>
      {addCommentArea}
      <GifPicker
        isOpen={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleGifSelect}
      />
    </div>
  );
}
