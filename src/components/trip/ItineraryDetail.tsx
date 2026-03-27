import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import type { RsvpSummary, TripParticipantRole } from "@/lib/types";
import { formatDayLabel } from "@/lib/utils";
import EventComments from "./EventComments";
import { formatItineraryItemTime, getItineraryBadge } from "./ItineraryCard";
import RsvpButtons from "./RsvpButtons";
import RsvpList from "./RsvpList";
import { useTripThemeStyle } from "./TripThemeProvider";

type DetailTab = "details" | "comments";

type ItineraryDetailProps = {
  currentUserId?: string | null;
  /** When opening from a deep link (e.g. notification on an event comment). */
  initialDetailTab?: DetailTab;
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
    <div className="border-2 border-[#121212] bg-white px-3 py-2.5">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--trip-paper-text,#121212)]">{label}</p>
      <p className="mt-0.5 break-words text-sm leading-5 text-[var(--trip-paper-muted,#666666)]">{value}</p>
    </div>
  );
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(trimmed);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = trimmed;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyableLocationRow({
  label,
  copyText,
  displayValue,
  onCopied,
}: {
  label: string;
  copyText: string;
  displayValue: string;
  onCopied: () => void;
}) {
  if (!displayValue) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={`Copy ${label} to clipboard`}
      className="w-full cursor-pointer border-2 border-[#121212] bg-white px-3 py-2.5 text-left transition hover:bg-[#F8F8F8] focus:outline-none focus:ring-2 focus:ring-[#D02020]/30"
      onClick={() => {
        void (async () => {
          const ok = await copyTextToClipboard(copyText);
          if (ok) {
            onCopied();
          }
        })();
      }}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--trip-paper-text,#121212)]">{label}</p>
      <p className="mt-0.5 break-words text-sm leading-5 text-[var(--trip-paper-muted,#666666)]">{displayValue}</p>
    </button>
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
  initialDetailTab,
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
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [copiedBanner, setCopiedBanner] = useState(false);
  const copyBannerTimeoutRef = useRef<number | null>(null);
  const wasOpenRef = useRef(false);
  const lastItemIdRef = useRef<string | null>(null);

  const showCopiedBanner = () => {
    if (copyBannerTimeoutRef.current) {
      window.clearTimeout(copyBannerTimeoutRef.current);
    }
    setCopiedBanner(true);
    copyBannerTimeoutRef.current = window.setTimeout(() => {
      setCopiedBanner(false);
      copyBannerTimeoutRef.current = null;
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (copyBannerTimeoutRef.current) {
        window.clearTimeout(copyBannerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setCopiedBanner(false);
      if (copyBannerTimeoutRef.current) {
        window.clearTimeout(copyBannerTimeoutRef.current);
        copyBannerTimeoutRef.current = null;
      }
    }
  }, [isOpen]);
  const themeStyle = useTripThemeStyle();
  const displayCreatorName = item?.created_by ? creatorName : null;

  useEffect(() => {
    if (!isOpen || !item) {
      wasOpenRef.current = false;
      lastItemIdRef.current = null;
      return;
    }

    const itemChanged = lastItemIdRef.current !== item.id;
    lastItemIdRef.current = item.id;

    if (!wasOpenRef.current || itemChanged) {
      queueMicrotask(() => {
        setActiveTab(initialDetailTab ?? "details");
      });
    }

    wasOpenRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tab reset keyed by item id only
  }, [initialDetailTab, isOpen, item?.id]);

  useEffect(() => {
    if (!item?.created_by) return;
    let isMounted = true;
    const supabase = createClient();
    type ProfileRow = { display_name: string | null };
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", item.created_by)
      .maybeSingle()
      .then(({ data }: { data: ProfileRow | null }) => {
        if (!isMounted) return;
        const name = data?.display_name?.trim();
        setCreatorName(name || "Someone");
      });
    return () => {
      isMounted = false;
    };
  }, [item?.id, item?.created_by]);

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

  const content = (
      <div
        className={`-mt-3 flex min-h-full flex-col sm:-mt-4 ${activeTab === "comments" && hasComments ? "h-full" : ""}`}
      >
        {hasComments ? (
          <div className="mb-1 mt-0.5 flex shrink-0 justify-center">
            <div
              className="flex w-fit gap-0.5 border-2 border-[#121212] bg-white p-0.5"
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
              className={`flex-none px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition focus:outline-none focus:ring-2 focus:ring-[#D02020]/30 ${
                activeTab === "details"
                  ? "bg-[var(--surface,#F8F8F8)] text-[var(--foreground,#121212)]"
                  : "text-[var(--trip-paper-muted,#666666)] hover:text-[var(--trip-paper-text,#121212)]"
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
              className={`flex-none px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition focus:outline-none focus:ring-2 focus:ring-[#D02020]/30 ${
                activeTab === "comments"
                  ? "bg-[var(--surface,#F8F8F8)] text-[var(--foreground,#121212)]"
                  : "text-[var(--trip-paper-muted,#666666)] hover:text-[var(--trip-paper-text,#121212)]"
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
            <div className="overflow-hidden border-2 border-[#121212] bg-[#F8F8F8]">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={item.title} className="h-48 w-full object-cover sm:h-56" src={item.image_url} />
          ) : (
            <div className="flex h-48 items-center justify-center text-5xl text-[#888888] sm:h-56">
              {badge.icon}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-8 items-center gap-1 bg-[#D02020]/10 px-3 text-xs font-bold uppercase tracking-widest text-[#D02020]">
            <span aria-hidden="true">{badge.icon}</span>
            {badge.label}
          </span>
          <span className="text-sm text-[var(--trip-paper-muted,#666666)]">{formatItineraryItemTime(item)}</span>
          {canEdit ? (
            <button
              type="button"
              aria-label={`Edit ${item.title}`}
              onClick={() => onEdit?.(item)}
              className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center border-2 border-[#121212] bg-white text-[#666666] transition hover:border-[#D02020] hover:bg-[#F8F8F8] hover:text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D02020]/30"
            >
              ✎
            </button>
          ) : null}
        </div>

        {item.description ? (
          <p className="text-sm leading-6 text-[var(--trip-paper-muted,#666666)] sm:text-base">{item.description}</p>
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
              className="text-sm font-bold text-[#D02020] underline decoration-[#D02020]/40 underline-offset-2 hover:decoration-[#D02020]"
            >
              See who&apos;s going
            </button>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <DetailRow label="Day" value={formatDayLabel(item.day_date)} />
          {displayCreatorName !== null ? (
            <DetailRow label="Created by" value={displayCreatorName} />
          ) : null}
          {item.item_type === "commute" ? (
            <>
              <DetailRow label="Departure" value={startTimeLabel} />
              <DetailRow label="Arrival" value={endTimeLabel} />
              <CopyableLocationRow
                copyText={originLabel}
                displayValue={`📍 ${originLabel}`}
                label="Origin"
                onCopied={showCopiedBanner}
              />
              <CopyableLocationRow
                copyText={destinationLabel}
                displayValue={`📍 ${destinationLabel}`}
                label="Destination"
                onCopied={showCopiedBanner}
              />
            </>
          ) : item.item_type === "event" ? (
            <>
              <DetailRow label="Time" value={eventTimeLabel} />
              <CopyableLocationRow
                copyText={originLabel}
                displayValue={`📍 ${originLabel}`}
                label="Location"
                onCopied={showCopiedBanner}
              />
            </>
          ) : (
            <>
              <DetailRow label="Starts" value={startTimeLabel} />
              <DetailRow label="Ends" value={endTimeLabel} />
              <CopyableLocationRow
                copyText={originLabel}
                displayValue={`📍 ${originLabel}`}
                label="Location"
                onCopied={showCopiedBanner}
              />
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
  );

  return (
    <Modal
      belowHeader={
        copiedBanner ? (
          <div
            className="border-b-2 border-[#121212] bg-[#F0C020] px-4 py-2.5 text-center text-sm font-bold text-[#121212]"
            role="status"
            aria-live="polite"
          >
            Copied to clipboard
          </div>
        ) : null
      }
      description={formatItineraryItemTime(item)}
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="sm:max-w-2xl"
      panelStyle={themeStyle ?? undefined}
      title={item.title}
    >
      {content}
      <RsvpList
        currentUserId={currentUserId}
        isOpen={showRsvpList}
        itineraryItemId={item.id}
        title={`Who's going: ${item.title}`}
        onClose={() => setShowRsvpList(false)}
      />
    </Modal>
  );
}
