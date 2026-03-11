import { format } from "date-fns";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import type { TripParticipantRole } from "@/lib/types";
import { formatDayLabel } from "@/lib/utils";
import { formatItineraryItemTime, getItineraryBadge } from "./ItineraryCard";

type ItineraryDetailProps = {
  isOpen: boolean;
  item: ItineraryListItem | null;
  onClose: () => void;
  onDelete?: (item: ItineraryListItem) => void;
  onEdit?: (item: ItineraryListItem) => void;
  userRole?: TripParticipantRole | null;
};

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-[1.25rem] border border-[#efd5c8] bg-white/80 px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#b56445]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#563a2e]">{value}</p>
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
  isOpen,
  item,
  onClose,
  onDelete,
  onEdit,
  userRole = null,
}: ItineraryDetailProps) {
  if (!item) {
    return null;
  }

  const canManage = userRole === "organizer" || userRole === "planner";
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
          {canManage ? (
            <Button
              variant="secondary"
              onClick={() => {
                onEdit?.(item);
              }}
            >
              Edit
            </Button>
          ) : null}
          {canManage ? (
            <Button
              className="border border-[#e2a69a] bg-[#c84f3d] text-white hover:bg-[#b84231] focus:ring-[#ffd4be]"
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
        <div className="overflow-hidden rounded-[1.8rem] border border-[#eed2c3] bg-[linear-gradient(135deg,#ffd8c7,#f0a36f)]">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={item.title} className="h-64 w-full object-cover sm:h-80" src={item.image_url} />
          ) : (
            <div className="flex h-64 items-center justify-center text-6xl text-[#7e422b] sm:h-80">
              {badge.icon}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#fff1e7] px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#a35637]">
            <span aria-hidden="true">{badge.icon}</span>
            {badge.label}
          </span>
          <span className="text-sm text-[#7a5749]">{formatItineraryItemTime(item)}</span>
        </div>

        {item.description ? (
          <p className="text-sm leading-7 text-[#563a2e] sm:text-base">{item.description}</p>
        ) : null}

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
      </div>
    </Modal>
  );
}
