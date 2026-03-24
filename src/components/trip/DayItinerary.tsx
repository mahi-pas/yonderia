"use client";

import { eachDayOfInterval, format, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { groupItineraryItemsByDay, type ItineraryListItem } from "@/hooks/useItinerary";
import type { TripParticipantRole } from "@/lib/types";
import AddEventModal from "./AddEventModal";
import ItineraryCard from "./ItineraryCard";
import ItineraryDetail from "./ItineraryDetail";

type DayItineraryProps = {
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
  onSelectItem?: (item: ItineraryListItem | null) => void;
  onUpdated?: (item: ItineraryListItem) => void;
  /** Expand the day that contains this item (deep links / notifications). */
  revealItemId?: string | null;
  selectedItem?: ItineraryListItem | null;
  tripEndDate: string;
  tripId: string;
  tripStartDate: string;
};

export default function DayItinerary({
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
  onSelectItem,
  onUpdated,
  revealItemId,
  selectedItem: controlledSelectedItem,
  tripEndDate,
  tripId,
  tripStartDate,
}: DayItineraryProps) {
  const [activeDayForAdd, setActiveDayForAdd] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryListItem | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(() => ({
    [tripStartDate]: true,
  }));
  const [internalSelectedItem, setInternalSelectedItem] = useState<ItineraryListItem | null>(null);

  const isControlled = controlledSelectedItem !== undefined && onSelectItem !== undefined;
  const selectedItem = isControlled ? controlledSelectedItem ?? null : internalSelectedItem;
  const setSelectedItem = useCallback(
    (item: ItineraryListItem | null) => {
      if (isControlled) onSelectItem?.(item);
      else setInternalSelectedItem(item);
    },
    [isControlled, onSelectItem],
  );

  const resolvedGroupedByDay = useMemo(() => groupedByDay ?? groupItineraryItemsByDay(items), [groupedByDay, items]);

  useEffect(() => {
    if (!revealItemId || items.length === 0) {
      return;
    }

    const match = items.find((it) => it.id === revealItemId);

    if (!match) {
      return;
    }

    queueMicrotask(() => {
      setExpandedDays((current) => ({
        ...current,
        [match.day_date]: true,
      }));
    });
  }, [items, revealItemId]);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const latestItem = items.find((item) => item.id === selectedItem.id) ?? null;

    if (!latestItem) {
      queueMicrotask(() => setSelectedItem(null));
      return;
    }

    if (latestItem !== selectedItem) {
      queueMicrotask(() => setSelectedItem(latestItem));
    }
  }, [items, selectedItem, setSelectedItem]);

  function handleOpenEdit(item: ItineraryListItem) {
    setSelectedItem(null);
    setActiveDayForAdd(null);
    setEditingItem(item);
  }

  const days = useMemo(
    () =>
      eachDayOfInterval({
        end: parseISO(tripEndDate),
        start: parseISO(tripStartDate),
      }).map((date, index) => ({
        dayDate: format(date, "yyyy-MM-dd"),
        index,
        label: format(date, "EEE, MMM d"),
      })),
    [tripEndDate, tripStartDate],
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase text-[var(--foreground)]">Itinerary</p>
          <h2 className="mt-1 font-display text-3xl leading-none text-[var(--foreground)]">Daily plan</h2>
        </div>
        <p className="text-sm text-[var(--foreground)]/90">{items.length} items</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#ef4444]/30 bg-[#450a0a]/90 px-4 py-3 text-sm text-[#fca5a5]">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {days.map((day) => {
          const dayItems = resolvedGroupedByDay.get(day.dayDate) ?? [];
          const isExpanded = expandedDays[day.dayDate] ?? day.index === 0;

          return (
            <div
              key={day.dayDate}
              className="overflow-hidden border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
            >
              <button
                className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[var(--surface-elevated)]"
                type="button"
                onClick={() => {
                  setExpandedDays((current) => ({
                    ...current,
                    [day.dayDate]: !isExpanded,
                  }));
                }}
              >
                <div>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    {`Day ${day.index + 1} — ${day.label}`}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--foreground)]/90">
                    {dayItems.length === 0
                      ? "Nothing added yet."
                      : `${dayItems.length} item${dayItems.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className={[
                    "text-2xl font-medium text-[var(--foreground)] opacity-90 transition-transform duration-300",
                    isExpanded ? "rotate-90" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  ›
                </span>
              </button>

              <div
                className={[
                  "expand-collapse grid",
                  isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="overflow-hidden">
                  <div className="space-y-3 border-t border-[var(--border)] px-4 py-4 sm:px-5">
                    {dayItems.length > 0 ? (
                      dayItems.map((item) => (
                        <ItineraryCard
                          canEdit={false}
                          commentCount={commentCountByItemId[item.id] ?? null}
                          currentUserId={currentUserId}
                          key={item.id}
                          item={item}
                          onClick={() => setSelectedItem(item)}
                          rsvpSummary={item.rsvpSummary ?? null}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)]/50 px-5 py-8 text-center text-sm leading-6 text-[var(--surface-muted,var(--muted-foreground))]">
                        {isLoading ? "Loading the plan..." : "Your crew hasn't added anything to this day yet."}
                      </div>
                    )}

                    {canManage && currentUserId ? (
                      <button
                        className="inline-flex min-h-11 items-center justify-center rounded-full bg-[image:var(--accent-gradient)] px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                        type="button"
                        onClick={() => {
                          setActiveDayForAdd(day.dayDate);
                        }}
                      >
                        Add Event
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canManage && currentUserId && (activeDayForAdd || editingItem) ? (
        <AddEventModal
          currentUserId={currentUserId}
          dayDate={editingItem?.day_date ?? activeDayForAdd ?? tripStartDate}
          editItem={editingItem}
          existingItems={items}
          isOpen={Boolean(activeDayForAdd || editingItem)}
          tripId={tripId}
          onClose={() => {
            setActiveDayForAdd(null);
            setEditingItem(null);
          }}
          onCreated={(item) => {
            onCreated?.(item);
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

      {!isControlled ? (
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
      ) : null}
    </section>
  );
}
