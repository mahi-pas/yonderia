import { format } from "date-fns";
import { useState } from "react";
import Button from "@/components/ui/Button";
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
  onDelete?: (item: ItineraryListItem) => void;
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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="gradient-text text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#d4d4d8]">{value}</p>
    </div>
  );
}

function formatDetailDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return format(new Date(value), "MMM d, yyyy h:mm a");
}

export default function ItineraryDetail({
  currentUserId = null,
  isOpen,
  item,
  onClose,
  onDelete,
  onEdit,
  rsvpSummary = null,
  tripId,
  userRole = null,
}: ItineraryDetailProps) {
  const [showRsvpList, setShowRsvpList] = useState(false);

  if (!item) {
    return null;
  }

  const canManage = userRole === "organizer" || userRole === "planner";
  const canDelete = canManage && typeof onDelete === "function";
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
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canEdit ? (
            <Button
              variant="secondary"
              onClick={() => {
                onEdit?.(item);
              }}
            >
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              className="border border-[#ef4444/30] bg-[#dc2626] text-white hover:bg-[#b91c1c] focus:ring-[#8b5cf6]/30"
              onClick={() => {
                onDelete?.(item);
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5 pb-8">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={item.title} className="h-64 w-full object-cover sm:h-80" src={item.image_url} />
          ) : (
            <div className="flex h-64 items-center justify-center text-6xl text-[var(--muted)] sm:h-80">
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
        </div>

        {item.description ? (
          <p className="text-sm leading-7 text-[#d4d4d8] sm:text-base">{item.description}</p>
        ) : null}

        <div className="space-y-3">
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

        <div className="grid gap-3 sm:grid-cols-2">
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

        {currentUserId && tripId ? (
          <EventComments
            currentUserId={currentUserId}
            itineraryItemId={item.id}
            tripId={tripId}
            userRole={userRole ?? null}
          />
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
