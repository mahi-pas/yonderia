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
  variant?: "default" | "lodging";
};

function getBadgeLabel(itemType: ItineraryListItem["item_type"]): string {
  if (itemType === "hotel") {
    return "Lodging";
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
  variant = "default",
}: ItineraryCardProps) {
  const badge = getItineraryBadge(item.item_type);
  const goingCount = rsvpSummary?.going ?? 0;
  const locationLabel =
    item.item_type === "commute"
      ? [item.location_name, item.destination_name].filter(Boolean).join(" to ")
      : (item.location_name ?? "Location coming together");

  if (variant === "lodging") {
    return (
      <div className="relative" id={`itinerary-item-${item.id}`}>
        <button
          className="group w-full overflow-hidden border-2 border-[#121212] bg-white text-left shadow-[4px_4px_0px_0px_black] transition focus:outline-none focus:ring-4 focus:ring-[#D02020]/20"
          type="button"
          onClick={onClick}
        >
          <div className="relative h-44 w-full overflow-hidden bg-[#F8F8F8] sm:h-52">
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={item.title} className="h-full w-full object-cover" src={item.image_url} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl text-[#888888]">{badge.icon}</div>
            )}
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-7 max-w-full shrink-0 items-center gap-1 bg-[#D02020]/10 px-2.5 text-xs font-bold tracking-widest uppercase text-[#D02020]">
                <span aria-hidden="true">{badge.icon}</span>
                {badge.label}
              </span>
              <span className="text-xs font-bold text-[var(--trip-card-text-muted,var(--muted-foreground,#666666))]">
                {goingCount} going
              </span>
              <RsvpButtons
                currentUserId={currentUserId}
                itineraryItemId={item.id}
                itemType={item.item_type}
                summary={rsvpSummary}
                variant="compact"
              />
              {currentUserId != null && commentCount != null && commentCount > 0 ? (
                <span
                  className="text-xs text-[var(--trip-card-text-muted,var(--muted-foreground,#666666))]"
                  title="Comments"
                >
                  💬 {commentCount}
                </span>
              ) : null}
            </div>

            <h3 className="line-clamp-2 text-xl font-black tracking-tight text-[var(--trip-card-text,var(--foreground,#121212))]">
              {item.title}
            </h3>
            <p className="line-clamp-1 text-sm text-[var(--trip-card-text-muted,var(--muted-foreground,#666666))]">
              📍 {locationLabel}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="border border-[#121212]/20 bg-[var(--surface,#F8F8F8)] px-2.5 py-2 text-xs font-bold text-[var(--trip-card-text-muted,var(--muted-foreground,#666666))]">
                <span className="block uppercase tracking-wide text-[var(--trip-card-text,var(--foreground,#121212))]">
                  Start
                </span>
                {item.start_time ? format(new Date(item.start_time), "EEE, MMM d h:mm a") : "Time TBD"}
              </p>
              <p className="border border-[#121212]/20 bg-[var(--surface,#F8F8F8)] px-2.5 py-2 text-xs font-bold text-[var(--trip-card-text-muted,var(--muted-foreground,#666666))]">
                <span className="block uppercase tracking-wide text-[var(--trip-card-text,var(--foreground,#121212))]">
                  End
                </span>
                {item.end_time ? format(new Date(item.end_time), "EEE, MMM d h:mm a") : "Time TBD"}
              </p>
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="relative" id={`itinerary-item-${item.id}`}>
      <button
        className={[
          "group flex min-w-0 w-full items-center gap-4 border-2 border-[#121212] bg-white p-3 text-left shadow-[4px_4px_0px_0px_black] transition focus:outline-none focus:ring-4 focus:ring-[#D02020]/20 sm:p-4",
          canEdit ? "pr-14 sm:pr-16" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        type="button"
        onClick={onClick}
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-[#F8F8F8] sm:h-20 sm:w-20">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={item.title} className="h-full w-full object-cover" src={item.image_url} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-[#888888]">
              {badge.icon}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 max-w-full shrink-0 items-center gap-1 bg-[#D02020]/10 px-2.5 text-xs font-bold tracking-widest uppercase text-[#D02020]">
              <span aria-hidden="true">{badge.icon}</span>
              {badge.label}
            </span>
            <span className="min-w-0 max-w-full break-words text-xs font-bold text-[var(--trip-card-text-muted,var(--muted-foreground,#666666))]">
              {formatItineraryItemTime(item)}
            </span>
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
              <span className="text-xs text-[var(--trip-card-text-muted,var(--muted-foreground,#666666))]" title="Comments">
                💬 {commentCount}
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 line-clamp-2 text-base font-bold text-[var(--trip-card-text,var(--foreground,#121212))] sm:text-lg">{item.title}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-[var(--trip-card-text-muted,var(--muted-foreground,#666666))]">{locationLabel}</p>
        </div>
      </button>
      {canEdit && onEdit ? (
        <button
          aria-label={`Edit ${item.title}`}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center border-2 border-[#121212] bg-[#F8F8F8] text-[#666666] shadow-[4px_4px_0px_0px_black] transition hover:border-[#D02020] hover:bg-[#D02020]/10 hover:text-[#D02020] focus:outline-none focus:ring-4 focus:ring-[#D02020]/20"
          type="button"
          onClick={(event) => {
            event.preventDefault();
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
