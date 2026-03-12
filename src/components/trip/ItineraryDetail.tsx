import { format } from "date-fns";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import type { RsvpSummary, TripParticipantRole } from "@/lib/types";
import { formatDayLabel } from "@/lib/utils";
import EventComments from "./EventComments";
import { formatItineraryItemTime, getItineraryBadge } from "./ItineraryCard";
import RsvpButtons from "./RsvpButtons";
import RsvpList from "./RsvpList";

type ItineraryDetailProps = {
  currentUserId?: string | null;
  isOpen: boolean;
  item: ItineraryListItem | null;
  onClose: () => void;
  onEdit?: (item: ItineraryListItem) => void;
  rsvpSummary?: RsvpSummary | null;
  tripId?: string;
  userRole?: TripParticipantRole | null;
};

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <p className="gradient-text text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm leading-5 text-[#d4d4d8]">{value}</p>
    </div>
  );
}

function formatDetailDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return format(new Date(value), "MMM d, yyyy h:mm a");
}

type DetailTab = "details" | "comments";

export default function ItineraryDetail({
  currentUserId = null,
  isOpen,
  item,
  onClose,
  onEdit,
  rsvpSummary = null,
  tripId,
  userRole = null,
}: ItineraryDetailProps) {
  const [showRsvpList, setShowRsvpList] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("details");

  if (!item) {
    return null;
  }

  const hasComments = !!(currentUserId && tripId);

  const canManage = userRole === "organizer" || userRole === "planner";
  const canEdit = canManage && typeof onEdit === "function";
  const badge = getItineraryBadge(item.item_type);
  const originLabel = item.location_name ?? "Location coming together";
  const destinationLabel = item.destination_name ?? "Destination coming together";
  const startTimeLabel = formatDetailDateTime(item.start_time);
  const endTimeLabel = formatDetailDateTime(item.end_time);
  const eventTimeLabel = item.item_type === "event" ? formatItineraryItemTime(item) : null;

  return (
    <Modal
      description={formatItineraryItemTime(item)}
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="sm:max-w-2xl"
      title={item.title}
    >
      <div
        className={`-mt-3 flex min-h-full flex-col sm:-mt-4 ${activeTab === "comments" && hasComments ? "h-full" : ""}`}
      >
        {hasComments ? (
          <div className="mb-1 mt-0.5 flex shrink-0 justify-center">
            <div
              className="flex w-fit gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5"
              role="tablist"
              aria-label="Event sections"
            >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "details"}
              aria-controls="event-details-panel"
              id="event-details-tab"
              onClick={() => setActiveTab("details")}
              className={`flex-none rounded-md px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 ${
                activeTab === "details"
                  ? "bg-[var(--surface-elevated)] text-[#fafafa] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[#d4d4d8]"
              }`}
            >
              Event details
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "comments"}
              aria-controls="event-comments-panel"
              id="event-comments-tab"
              onClick={() => setActiveTab("comments")}
              className={`flex-none rounded-md px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 ${
                activeTab === "comments"
                  ? "bg-[var(--surface-elevated)] text-[#fafafa] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[#d4d4d8]"
              }`}
            >
              Comments
            </button>
            </div>
          </div>
        ) : null}

        {activeTab === "details" ? (
          <div
            id="event-details-panel"
            role="tabpanel"
            aria-labelledby="event-details-tab"
            className="space-y-4 pb-4"
          >
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={item.title} className="h-48 w-full object-cover sm:h-56" src={item.image_url} />
          ) : (
            <div className="flex h-48 items-center justify-center text-5xl text-[var(--muted)] sm:h-56">
              {badge.icon}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[#8b5cf6]/10 px-3 text-xs font-medium uppercase tracking-wide text-[#a78bfa]">
            <span aria-hidden="true">{badge.icon}</span>
            {badge.label}
          </span>
          <span className="text-sm text-[var(--muted)]">{formatItineraryItemTime(item)}</span>
          {canEdit ? (
            <button
              type="button"
              aria-label={`Edit ${item.title}`}
              onClick={() => onEdit?.(item)}
              className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[#8b5cf6]/40 hover:bg-[var(--surface-elevated)] hover:text-[#fafafa] focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30"
            >
              ✎
            </button>
          ) : null}
        </div>

        {item.description ? (
          <p className="text-sm leading-6 text-[#d4d4d8] sm:text-base">{item.description}</p>
        ) : null}

        <div className="space-y-2">
          <RsvpButtons
            currentUserId={currentUserId}
            itineraryItemId={item.id}
            itemType={item.item_type}
            summary={rsvpSummary}
            variant="full"
          />
          {currentUserId ? (
            <button
              type="button"
              onClick={() => setShowRsvpList(true)}
              className="text-sm font-medium text-[#a78bfa] underline decoration-[#8b5cf6]/40 underline-offset-2 hover:decoration-[#8b5cf6]"
            >
              See who’s going
            </button>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <DetailRow label="Day" value={formatDayLabel(item.day_date)} />
          {item.item_type === "commute" ? (
            <>
              <DetailRow label="Departure" value={startTimeLabel} />
              <DetailRow label="Arrival" value={endTimeLabel} />
              <DetailRow label="Origin" value={`📍 ${originLabel}`} />
              <DetailRow label="Destination" value={`📍 ${destinationLabel}`} />
            </>
          ) : item.item_type === "event" ? (
            <>
              <DetailRow label="Time" value={eventTimeLabel} />
              <DetailRow label="Location" value={`📍 ${originLabel}`} />
            </>
          ) : (
            <>
              <DetailRow label="Starts" value={startTimeLabel} />
              <DetailRow label="Ends" value={endTimeLabel} />
              <DetailRow label="Location" value={`📍 ${originLabel}`} />
            </>
          )}
        </div>
          </div>
        ) : hasComments ? (
          <div
            id="event-comments-panel"
            role="tabpanel"
            aria-labelledby="event-comments-tab"
            className="flex min-h-0 flex-1 flex-col"
          >
            <EventComments
              currentUserId={currentUserId!}
              fullView
              itineraryItemId={item.id}
              tripId={tripId!}
              userRole={userRole ?? null}
            />
          </div>
        ) : null}
      </div>

      <RsvpList
        currentUserId={currentUserId}
        isOpen={showRsvpList}
        itineraryItemId={item.id}
        title={`Who’s going: ${item.title}`}
        onClose={() => setShowRsvpList(false)}
      />
    </Modal>
  );
}
