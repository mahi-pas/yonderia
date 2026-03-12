"use client";

import { useMemo, useState } from "react";
import { groupItineraryItemsByDay, type ItineraryListItem } from "@/hooks/useItinerary";
import type { TripParticipantRole } from "@/lib/types";
import { useAllEventComments } from "@/hooks/useAllEventComments";
import AllCommentsView from "./AllCommentsView";
import DayItinerary from "./DayItinerary";
import ItineraryDetail from "./ItineraryDetail";

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

export default function ItineraryWithComments({
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
  const [activeTab, setActiveTab] = useState<"itinerary" | "comments">("itinerary");
  const [selectedItem, setSelectedItem] = useState<ItineraryListItem | null>(null);

  const itineraryItemIds = useMemo(() => items.map((i) => i.id), [items]);
  const { comments, error: commentsError } = useAllEventComments({
    itineraryItemIds,
    tripId,
  });
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function handleOpenEdit(_item: ItineraryListItem) {
    setSelectedItem(null);
    setActiveTab("itinerary");
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex items-center justify-between gap-4">
          <div role="tablist" aria-label="Itinerary and comments" className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "itinerary"}
              aria-controls="itinerary-panel"
              id="itinerary-tab"
              className="min-w-[7rem] rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:min-w-[8rem] sm:py-3"
              style={{
                backgroundColor: activeTab === "itinerary" ? "var(--surface)" : "transparent",
                color: activeTab === "itinerary" ? "#fafafa" : "var(--muted-foreground)",
              }}
              onClick={() => setActiveTab("itinerary")}
            >
              Itinerary
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "comments"}
              aria-controls="comments-panel"
              id="comments-tab"
              className="min-w-[7rem] rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:min-w-[8rem] sm:py-3"
              style={{
                backgroundColor: activeTab === "comments" ? "var(--surface)" : "transparent",
                color: activeTab === "comments" ? "#fafafa" : "var(--muted-foreground)",
              }}
              onClick={() => setActiveTab("comments")}
            >
              Comments
              {comments.length > 0 ? (
                <span className="ml-1.5 rounded-full bg-[#8b5cf6]/30 px-1.5 py-0.5 text-xs tabular-nums">
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
              selectedItem={selectedItem}
              tripEndDate={tripEndDate}
              tripId={tripId}
              tripStartDate={tripStartDate}
            />
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
              comments={comments}
              error={commentsError}
              itemById={itemById}
              onEventClick={(item) => setSelectedItem(item)}
            />
          ) : null}
        </div>
      </div>

      <ItineraryDetail
        currentUserId={currentUserId}
        isOpen={selectedItem !== null}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onEdit={handleOpenEdit}
        rsvpSummary={selectedItem?.rsvpSummary ?? null}
        tripId={tripId}
        userRole={currentUserRole}
      />
    </section>
  );
}
