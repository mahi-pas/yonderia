import { format, isSameDay } from "date-fns";
import type { ItineraryListItem } from "@/hooks/useItinerary";

type ItineraryCardProps = {
  canEdit?: boolean;
  item: ItineraryListItem;
  onClick: () => void;
  onEdit?: (item: ItineraryListItem) => void;
};

function getBadgeLabel(itemType: ItineraryListItem["item_type"]): string {
  if (itemType === "hotel") {
    return "Hotel";
  }

  if (itemType === "commute") {
    return "Commute";
  }

  return "Event";
}

function getBadgeIcon(itemType: ItineraryListItem["item_type"]): string {
  if (itemType === "hotel") {
    return "🛏";
  }

  if (itemType === "commute") {
    return "✈";
  }

  return "🗓";
}

function formatTimeOrDateTime(value: string, includeDate: boolean): string {
  return format(new Date(value), includeDate ? "MMM d, h:mm a" : "h:mm a");
}

function spansMultipleDays(item: Pick<ItineraryListItem, "end_time" | "start_time">): boolean {
  if (!item.start_time || !item.end_time) {
    return false;
  }

  return !isSameDay(new Date(item.start_time), new Date(item.end_time));
}

export function formatItineraryItemTime(item: ItineraryListItem): string {
  if (!item.start_time && item.item_type === "hotel") {
    return "Check-in time TBD";
  }

  if (!item.start_time) {
    return "Time TBD";
  }

  const includeDate = spansMultipleDays(item);
  const start = formatTimeOrDateTime(item.start_time, includeDate);

  if (!item.end_time) {
    if (item.item_type === "hotel") {
      return `Check-in ${start}`;
    }

    if (item.item_type === "commute") {
      return `Departs ${start}`;
    }

    return start;
  }

  const end = formatTimeOrDateTime(item.end_time, includeDate);

  if (item.item_type === "hotel") {
    return `${start} check-in • ${end} check-out`;
  }

  if (item.item_type === "commute") {
    return `Departs ${start} → Arrives ${end}`;
  }

  return `${start} – ${end}`;
}

export function getItineraryBadge(itemType: ItineraryListItem["item_type"]) {
  return {
    icon: getBadgeIcon(itemType),
    label: getBadgeLabel(itemType),
  };
}

export default function ItineraryCard({ canEdit = false, item, onClick, onEdit }: ItineraryCardProps) {
  const badge = getItineraryBadge(item.item_type);
  const locationLabel =
    item.item_type === "commute"
      ? [item.location_name, item.destination_name].filter(Boolean).join(" to ")
      : (item.location_name ?? "Location coming together");

  return (
    <div className="relative">
      <button
        className={[
          "group flex w-full items-center gap-4 rounded-[1.6rem] border border-[#efd5c8] bg-white/90 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#d88d68] hover:shadow-[0_18px_45px_rgba(123,63,35,0.12)] focus:outline-none focus:ring-4 focus:ring-[#ffe2d4] sm:p-4",
          canEdit ? "pr-14 sm:pr-16" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        type="button"
        onClick={onClick}
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[1.2rem] bg-[linear-gradient(135deg,#ffd8c7,#f4ab7d)] sm:h-20 sm:w-20">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={item.title} className="h-full w-full object-cover" src={item.image_url} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-[#7e422b]">
              {badge.icon}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-[#fff1e7] px-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#a35637]">
              <span aria-hidden="true">{badge.icon}</span>
              {badge.label}
            </span>
            <span className="text-xs font-medium text-[#926756]">{formatItineraryItemTime(item)}</span>
          </div>

          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-[#34180f] sm:text-lg">{item.title}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-[#755142]">{locationLabel}</p>
        </div>

        <span
          aria-hidden="true"
          className="shrink-0 text-lg text-[#ad6c51] transition group-hover:translate-x-0.5"
        >
          ›
        </span>
      </button>
      {canEdit && onEdit ? (
        <button
          aria-label={`Edit ${item.title}`}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e6b9a6] bg-white/95 text-[#9a4d2f] shadow-sm transition hover:border-[#d88d68] hover:bg-[#fff1ea] focus:outline-none focus:ring-4 focus:ring-[#ffe2d4]"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(item);
          }}
        >
          ✎
        </button>
      ) : null}
    </div>
  );
}
