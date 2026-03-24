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
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#F8F8F8]">
        {comment.author.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.author.avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-[#666666]">
            {(comment.author.nickname || comment.author.display_name || "?")[0]}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#121212]">
            {comment.author.nickname || comment.author.display_name || "Someone"}
          </span>
          <span className="text-xs text-[#666666]">
            {format(new Date(comment.created_at), "MMM d, h:mm a")}
          </span>
          {canDelete ? (
            <button
              type="button"
              aria-label="Delete comment"
              className="ml-auto opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              onClick={() => onDelete(comment.id)}
            >
              <span className="text-[#666666] hover:text-[#D02020]" aria-hidden>🗑</span>
            </button>
          ) : null}
        </div>
        {comment.content ? (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[#121212]/80">
            {comment.content}
          </p>
        ) : null}
        {comment.gif_url ? (
          <div className="mt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={comment.gif_url}
              alt="GIF"
              className="max-h-40 max-w-full object-contain"
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
        <p className="px-1 py-2 text-sm text-[#D02020]">{error}</p>
      ) : null}
      {comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#666666]">
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
      <div className="flex max-w-md gap-2 md:max-w-xl lg:max-w-2xl">
        <textarea
          placeholder="Add a comment..."
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          rows={1}
          className="min-h-9 max-h-24 flex-1 resize-none border-2 border-[#121212] bg-[#F8F8F8] px-3 py-2 text-sm text-[#121212] placeholder:text-[#666666] focus:border-[#D02020] focus:outline-none focus:ring-2 focus:ring-[#D02020]/20"
        />
        <button
          type="button"
          aria-label="Add GIF"
          className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-[#121212] bg-[#F8F8F8] text-sm text-[#666666] transition hover:bg-white hover:text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D02020]/20"
          onClick={() => setShowGifPicker(true)}
        >
          GIF
        </button>
        <button
          type="button"
          disabled={!canSend}
          className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#D02020] text-white shadow-[4px_4px_0px_0px_black] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:brightness-110 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#D02020]/30"
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
            className="h-14 w-14 object-cover"
          />
          <span className="text-xs text-[#666666]">GIF added</span>
          <button
            type="button"
            className="text-xs text-[#D02020] underline"
            onClick={() => setPendingGif(null)}
          >
            Remove
          </button>
        </div>
      ) : null}
      {draft.length > MAX_LENGTH * 0.9 ? (
        <p className="text-xs text-[#666666]">
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
        <div className="shrink-0 space-y-2 border-t-2 border-[#121212] pt-4">
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
    <div className="space-y-3 border-t-2 border-[#121212] pt-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">
        Comments
      </p>
      <div className="max-h-64 min-h-[6rem] overflow-y-auto border-2 border-[#121212] bg-[#F8F8F8] p-3">
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
