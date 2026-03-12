import { format, isSameDay } from "date-fns";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import type { RsvpSummary } from "@/lib/types";
import RsvpButtons from "./RsvpButtons";

type ItineraryCardProps = {
  canEdit?: boolean;
  commentCount?: number | null;
  currentUserId?: string | null;
  item: ItineraryListItem;
  onClick: () => void;
  onEdit?: (item: ItineraryListItem) => void;
  rsvpSummary?: RsvpSummary | null;
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
    return "\u{1F6CF}";
  }

  if (itemType === "commute") {
    return "\u2708";
  }

  return "\u{1F5D3}";
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
    return `${start} check-in \u2022 ${end} check-out`;
  }

  if (item.item_type === "commute") {
    return `Departs ${start} \u2192 Arrives ${end}`;
  }

  return `${start} \u2013 ${end}`;
}

export function getItineraryBadge(itemType: ItineraryListItem["item_type"]) {
  return {
    icon: getBadgeIcon(itemType),
    label: getBadgeLabel(itemType),
  };
}

export default function ItineraryCard({
  canEdit = false,
  commentCount = null,
  currentUserId = null,
  item,
  onClick,
  onEdit,
  rsvpSummary = null,
}: ItineraryCardProps) {
  const badge = getItineraryBadge(item.item_type);
  const locationLabel =
    item.item_type === "commute"
      ? [item.location_name, item.destination_name].filter(Boolean).join(" to ")
      : (item.location_name ?? "Location coming together");

  return (
    <div className="relative">
      <button
        className={[
          "card-hover group flex w-full items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15)] backdrop-blur-sm transition gradient-border-hover focus:outline-none focus:ring-4 focus:ring-[#8b5cf6]/20 sm:p-4",
          canEdit ? "pr-14 sm:pr-16" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        type="button"
        onClick={onClick}
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-elevated)] sm:h-20 sm:w-20">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={item.title} className="h-full w-full object-cover" src={item.image_url} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-[var(--muted)]">
              {badge.icon}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-[#8b5cf6]/10 px-2.5 text-xs font-semibold tracking-wide uppercase text-[#a78bfa]">
              <span aria-hidden="true">{badge.icon}</span>
              {badge.label}
            </span>
            <span className="text-xs font-medium text-[var(--muted)]">{formatItineraryItemTime(item)}</span>
            {item.item_type === "event" ? (
              <RsvpButtons
                currentUserId={currentUserId}
                itineraryItemId={item.id}
                itemType={item.item_type}
                summary={rsvpSummary}
                variant="compact"
              />
            ) : null}
            {currentUserId != null && commentCount != null && commentCount > 0 ? (
              <span className="text-xs text-[var(--muted-foreground)]" title="Comments">
                💬 {commentCount}
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-[#fafafa] sm:text-lg">{item.title}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">{locationLabel}</p>
        </div>

        <span
          aria-hidden="true"
          className="shrink-0 text-lg text-[#8b5cf6] transition group-hover:translate-x-0.5"
        >
          ›
        </span>
      </button>
      {canEdit && onEdit ? (
        <button
          aria-label={`Edit ${item.title}`}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted)] shadow-sm transition hover:border-[#8b5cf6]/40 hover:bg-[var(--surface-elevated)] focus:outline-none focus:ring-4 focus:ring-[#8b5cf6]/20"
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
