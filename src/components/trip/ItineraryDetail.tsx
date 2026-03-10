import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import { formatDateTime, formatDayLabel } from "@/lib/utils";
import { formatItineraryItemTime, getItineraryBadge } from "./ItineraryCard";

type ItineraryDetailProps = {
  isOpen: boolean;
  item: ItineraryListItem | null;
  onClose: () => void;
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

export default function ItineraryDetail({ isOpen, item, onClose }: ItineraryDetailProps) {
  if (!item) {
    return null;
  }

  const badge = getItineraryBadge(item.item_type);
  const originLabel = item.location_name ?? "Location coming together";
  const destinationLabel = item.destination_name ?? "Destination coming together";

  return (
    <Modal
      description={formatItineraryItemTime(item)}
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="sm:max-w-2xl"
      title={item.title}
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
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
          <DetailRow label="Starts" value={item.start_time ? formatDateTime(item.start_time) : null} />
          <DetailRow label="Ends" value={item.end_time ? formatDateTime(item.end_time) : null} />
          {item.item_type === "commute" ? (
            <>
              <DetailRow label="Origin" value={`📍 ${originLabel}`} />
              <DetailRow label="Destination" value={`📍 ${destinationLabel}`} />
            </>
          ) : (
            <DetailRow label="Location" value={`📍 ${originLabel}`} />
          )}
        </div>
      </div>
    </Modal>
  );
}
