"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ItineraryListItem } from "@/hooks/useItinerary";
import type { TripParticipantRole } from "@/lib/types";
import { useAllEventComments } from "@/hooks/useAllEventComments";
import AddEventModal from "./AddEventModal";
import AllCommentsView from "./AllCommentsView";
import DayItinerary from "./DayItinerary";
import ItineraryCard from "./ItineraryCard";
import ItineraryDetail from "./ItineraryDetail";

const FOCUS_QUERY_KEYS = ["item", "comment", "tab", "open", "detailComments"] as const;

function stripTripFocusParams(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  sourceParams: URLSearchParams,
): void {
  const next = new URLSearchParams(sourceParams.toString());
  let changed = false;

  for (const key of FOCUS_QUERY_KEYS) {
    if (next.has(key)) {
      next.delete(key);
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  const query = next.toString();
  void router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
}

type ItineraryWithCommentsProps = {
  canManage: boolean;
  commentCountByItemId?: Record<string, number>;
  currentUserId?: string;
  currentUserRole?: TripParticipantRole | null;
  error?: string | null;
  groupedByDay?: Map<string, ItineraryListItem[]>;
  isLoading?: boolean;
  items: ItineraryListItem[];
  onDeleted?: (itemId: string) => void;
  onCreated?: (item: ItineraryListItem) => void;
  onUpdated?: (item: ItineraryListItem) => void;
  tripEndDate: string;
  tripId: string;
  tripStartDate: string;
};

function ItineraryWithCommentsShell({
  canManage,
  commentCountByItemId = {},
  currentUserId,
  currentUserRole = null,
  error = null,
  groupedByDay,
  isLoading = false,
  items,
  onDeleted,
  onCreated,
  onUpdated,
  tripEndDate,
  tripId,
  tripStartDate,
}: ItineraryWithCommentsProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const processingRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<"itinerary" | "lodging" | "comments">("itinerary");
  const [editingItem, setEditingItem] = useState<ItineraryListItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItineraryListItem | null>(null);
  const [revealItemId, setRevealItemId] = useState<string | null>(null);
  const [detailOpenToComments, setDetailOpenToComments] = useState(false);

  const itineraryItemIds = useMemo(() => items.map((i) => i.id), [items]);
  const {
    addAnnouncement,
    addTripComment,
    comments,
    error: commentsError,
  } = useAllEventComments({
    itineraryItemIds,
    tripId,
  });
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const lodgingItems = useMemo(
    () =>
      items
        .filter((item) => item.item_type === "hotel")
        .sort((left, right) => {
          const leftTime = left.start_time ? new Date(left.start_time).getTime() : new Date(left.day_date).getTime();
          const rightTime = right.start_time ? new Date(right.start_time).getTime() : new Date(right.day_date).getTime();
          return leftTime - rightTime;
        }),
    [items],
  );

  const querySignature = searchParams.toString();

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const itemId = searchParams.get("item");
    const commentId = searchParams.get("comment");
    const tab = searchParams.get("tab");
    const openModal = searchParams.get("open") === "1";
    const detailComments = searchParams.get("detailComments") === "1";

    const runComments = tab === "comments" && Boolean(commentId);
    const runItem = Boolean(itemId);

    if (!runComments && !runItem) {
      return;
    }

    const sig = runComments ? `comments:${commentId}` : `item:${itemId}:${openModal}:${detailComments}`;

    if (processingRef.current === sig) {
      return;
    }

    processingRef.current = sig;

    const paramsSnapshot = new URLSearchParams(searchParams.toString());
    const timeoutIds: number[] = [];

    if (runComments && commentId) {
      queueMicrotask(() => {
        setActiveTab("comments");
      });
      timeoutIds.push(
        window.setTimeout(() => {
          document
            .getElementById(`event-comment-${commentId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
          stripTripFocusParams(router, pathname, paramsSnapshot);
          processingRef.current = null;
        }, 450),
      );
    } else if (itemId) {
      const item = items.find((i) => i.id === itemId);

      if (!item) {
        stripTripFocusParams(router, pathname, paramsSnapshot);
        processingRef.current = null;
        return () => {
          for (const id of timeoutIds) {
            window.clearTimeout(id);
          }
        };
      }

      queueMicrotask(() => {
        setActiveTab(item.item_type === "hotel" ? "lodging" : "itinerary");
        setRevealItemId(itemId);
      });

      timeoutIds.push(
        window.setTimeout(() => {
          document
            .getElementById(`itinerary-item-${itemId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });

          if (openModal || detailComments) {
            setSelectedItem(item);

            if (detailComments) {
              setDetailOpenToComments(true);
            }
          }

          stripTripFocusParams(router, pathname, paramsSnapshot);
          processingRef.current = null;
        }, 420),
      );

      timeoutIds.push(
        window.setTimeout(() => {
          setRevealItemId(null);
        }, 4000),
      );
    }

    return () => {
      for (const id of timeoutIds) {
        window.clearTimeout(id);
      }
    };
  }, [items, querySignature, pathname, router, searchParams]);

  function handleOpenEdit(item: ItineraryListItem) {
    setSelectedItem(null);
    setActiveTab(item.item_type === "hotel" ? "lodging" : "itinerary");
    setEditingItem(item);
  }

  function handleCloseDetail() {
    setSelectedItem(null);
    setDetailOpenToComments(false);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Itinerary, lodging, and comments"
            className="trip-card inline-flex divide-x-2 divide-[#121212] border-2 border-[#121212] bg-white shadow-[4px_4px_0px_0px_black]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "itinerary"}
              aria-controls="itinerary-panel"
              id="itinerary-tab"
              className={`min-w-[7rem] px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors sm:min-w-[8rem] sm:py-3 ${
                activeTab === "itinerary"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-elevated)] text-[var(--foreground)]"
              }`}
              onClick={() => setActiveTab("itinerary")}
            >
              Itinerary
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "lodging"}
              aria-controls="lodging-panel"
              id="lodging-tab"
              className={`min-w-[7rem] px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors sm:min-w-[8rem] sm:py-3 ${
                activeTab === "lodging"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-elevated)] text-[var(--foreground)]"
              }`}
              onClick={() => setActiveTab("lodging")}
            >
              Lodging
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "comments"}
              aria-controls="comments-panel"
              id="comments-tab"
              className={`inline-flex min-w-[7rem] items-center justify-center gap-1 px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors sm:min-w-[8rem] sm:py-3 ${
                activeTab === "comments"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-elevated)] text-[var(--foreground)]"
              }`}
              onClick={() => setActiveTab("comments")}
            >
              Comments
              {comments.length > 0 ? (
                <span className="ml-0.5 min-w-[1.25rem] rounded-full border border-[#121212] bg-white px-1.5 py-0.5 text-center text-xs font-bold tabular-nums text-[#121212]">
                  {comments.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        <div
          id="itinerary-panel"
          role="tabpanel"
          aria-labelledby="itinerary-tab"
          hidden={activeTab !== "itinerary"}
          className="focus:outline-none"
        >
          {activeTab === "itinerary" ? (
            <DayItinerary
              canManage={canManage}
              commentCountByItemId={commentCountByItemId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              error={error}
              groupedByDay={groupedByDay}
              isLoading={isLoading}
              items={items}
              onDeleted={onDeleted}
              onCreated={onCreated}
              onSelectItem={setSelectedItem}
              onUpdated={onUpdated}
              revealItemId={revealItemId}
              selectedItem={selectedItem}
              tripEndDate={tripEndDate}
              tripId={tripId}
              tripStartDate={tripStartDate}
            />
          ) : null}
        </div>

        <div
          id="lodging-panel"
          role="tabpanel"
          aria-labelledby="lodging-tab"
          hidden={activeTab !== "lodging"}
          className="focus:outline-none"
        >
          {activeTab === "lodging" ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-[var(--foreground,#121212)]">
                    Lodging
                  </p>
                  <h2 className="mt-1 font-black text-3xl uppercase tracking-tighter leading-[0.9] text-[var(--foreground,#121212)]">
                    Where everyone is staying
                  </h2>
                </div>
                <p className="text-sm font-bold text-[var(--muted-foreground,#666666)]">
                  {lodgingItems.length} stay{lodgingItems.length === 1 ? "" : "s"}
                </p>
              </div>
              {lodgingItems.length > 0 ? (
                <div className="grid gap-4">
                  {lodgingItems.map((item) => (
                    <ItineraryCard
                      commentCount={commentCountByItemId[item.id] ?? null}
                      currentUserId={currentUserId}
                      item={item}
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      rsvpSummary={item.rsvpSummary ?? null}
                      variant="lodging"
                    />
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-[var(--border,#121212)] bg-[var(--surface,#F8F8F8)]/50 px-5 py-8 text-center text-sm font-bold leading-6 text-[var(--muted-foreground,#666666)]">
                  No lodging added yet.
                </div>
              )}
            </section>
          ) : null}
        </div>

        <div
          id="comments-panel"
          role="tabpanel"
          aria-labelledby="comments-tab"
          hidden={activeTab !== "comments"}
          className="focus:outline-none"
        >
          {activeTab === "comments" ? (
            <AllCommentsView
              addAnnouncement={addAnnouncement}
              addTripComment={addTripComment}
              comments={comments}
              currentUserId={currentUserId ?? null}
              error={commentsError}
              itemById={itemById}
              onEventClick={(item) => setSelectedItem(item)}
              tripId={tripId}
              userRole={currentUserRole}
            />
          ) : null}
        </div>
      </div>

      <ItineraryDetail
        currentUserId={currentUserId}
        initialDetailTab={detailOpenToComments ? "comments" : undefined}
        isOpen={selectedItem !== null}
        item={selectedItem}
        onClose={handleCloseDetail}
        onEdit={handleOpenEdit}
        rsvpSummary={selectedItem?.rsvpSummary ?? null}
        tripId={tripId}
        userRole={currentUserRole}
      />

      {canManage && currentUserId && editingItem ? (
        <AddEventModal
          currentUserId={currentUserId}
          dayDate={editingItem.day_date}
          editItem={editingItem}
          existingItems={items}
          isOpen
          tripId={tripId}
          onClose={() => setEditingItem(null)}
          onCreated={(item) => {
            onCreated?.(item);
            setEditingItem(null);
          }}
          onDeleted={(itemId) => {
            onDeleted?.(itemId);
            setEditingItem(null);
          }}
          onUpdated={(item) => {
            onUpdated?.(item);
            setEditingItem(null);
          }}
        />
      ) : null}
    </section>
  );
}

export default function ItineraryWithComments(props: ItineraryWithCommentsProps) {
  return (
    <Suspense fallback={null}>
      <ItineraryWithCommentsShell {...props} />
    </Suspense>
  );
}
