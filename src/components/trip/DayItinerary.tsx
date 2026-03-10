"use client";

import { eachDayOfInterval, format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { useItinerary, type ItineraryListItem } from "@/hooks/useItinerary";
import AddEventModal from "./AddEventModal";
import ItineraryCard from "./ItineraryCard";
import ItineraryDetail from "./ItineraryDetail";

type DayItineraryProps = {
  canManage: boolean;
  currentUserId?: string;
  initialItems: ItineraryListItem[];
  readOnly?: boolean;
  tripEndDate: string;
  tripId: string;
  tripStartDate: string;
};

export default function DayItinerary({
  canManage,
  currentUserId,
  initialItems,
  readOnly = false,
  tripEndDate,
  tripId,
  tripStartDate,
}: DayItineraryProps) {
  const [activeDayForAdd, setActiveDayForAdd] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(() => ({
    [tripStartDate]: true,
  }));
  const [selectedItem, setSelectedItem] = useState<ItineraryListItem | null>(null);
  const { error, groupedByDay, isLoading, itineraryItems, upsertLocalItem } = useItinerary({
    enabled: !readOnly,
    initialItems,
    tripId,
  });

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
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Itinerary</p>
          <h2 className="mt-1 font-display text-3xl leading-none text-[#34180f]">Daily plan</h2>
        </div>
        <p className="text-sm text-[#7e5b4c]">{itineraryItems.length} items</p>
      </div>

      {error ? (
        <div className="rounded-[1.25rem] border border-[#efb9a3] bg-[#fff1ea] px-4 py-3 text-sm text-[#8b3f22]">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {days.map((day) => {
          const dayItems = groupedByDay.get(day.dayDate) ?? [];
          const isExpanded = expandedDays[day.dayDate] ?? day.index === 0;

          return (
            <div
              key={day.dayDate}
              className="overflow-hidden rounded-[1.75rem] border border-[#efd5c8] bg-white/80 shadow-sm"
            >
              <button
                className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#fff7f2]"
                type="button"
                onClick={() => {
                  setExpandedDays((current) => ({
                    ...current,
                    [day.dayDate]: !isExpanded,
                  }));
                }}
              >
                <div>
                  <h3 className="text-lg font-semibold text-[#34180f]">
                    {`Day ${day.index + 1} — ${day.label}`}
                  </h3>
                  <p className="mt-1 text-sm text-[#8a6455]">
                    {dayItems.length === 0
                      ? "Nothing added yet."
                      : `${dayItems.length} item${dayItems.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className={[
                    "text-xl text-[#a85c3d] transition-transform duration-300",
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
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                  isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="overflow-hidden">
                  <div className="space-y-3 border-t border-[#f3ddd2] px-4 py-4 sm:px-5">
                    {dayItems.length > 0 ? (
                      dayItems.map((item) => (
                        <ItineraryCard
                          key={item.id}
                          item={item}
                          onClick={() => {
                            setSelectedItem(item);
                          }}
                        />
                      ))
                    ) : (
                      <div className="rounded-[1.5rem] border border-dashed border-[#dfb7a4] bg-[linear-gradient(180deg,#fff8f4,#fff2ea)] px-5 py-8 text-center text-sm leading-6 text-[#7f5d50]">
                        {isLoading ? "Loading the plan..." : "Your crew hasn't added anything to this day yet."}
                      </div>
                    )}

                    {canManage && currentUserId ? (
                      <button
                        className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d88d68] bg-[#fff4ec] px-4 text-sm font-semibold text-[#9a4d2f] transition hover:bg-[#ffe9dd]"
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

      {canManage && currentUserId && activeDayForAdd ? (
        <AddEventModal
          currentUserId={currentUserId}
          dayDate={activeDayForAdd}
          existingItems={itineraryItems}
          isOpen={Boolean(activeDayForAdd)}
          tripId={tripId}
          onClose={() => {
            setActiveDayForAdd(null);
          }}
          onCreated={upsertLocalItem}
        />
      ) : null}

      <ItineraryDetail
        isOpen={selectedItem !== null}
        item={selectedItem}
        onClose={() => {
          setSelectedItem(null);
        }}
      />
    </section>
  );
}
