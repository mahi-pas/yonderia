"use client";

import { useEventRsvps } from "@/hooks/useEventRsvps";
import type { RsvpStatus, RsvpSummary } from "@/lib/types";
import RsvpGoingAvatars from "./RsvpGoingAvatars";

type RsvpButtonsProps = {
  currentUserId: string | null;
  itineraryItemId: string;
  itemType: "event" | "hotel" | "commute";
  summary?: RsvpSummary | null;
  variant?: "compact" | "full";
};

const RSVP_LABELS: Record<RsvpStatus, string> = {
  going: "Going",
  interested: "Interested",
  not_going: "Not going",
};

function CountsLine({
  summary,
  showNotGoingTooltip = false,
}: {
  summary: RsvpSummary;
  showNotGoingTooltip?: boolean;
}) {
  const parts: string[] = [];
  if (summary.going > 0) parts.push(`${summary.going} going`);
  if (summary.interested > 0) parts.push(`${summary.interested} interested`);
  const main = parts.join(" · ");
  const notGoingTip =
    showNotGoingTooltip && summary.not_going > 0
      ? ` · ${summary.not_going} not going`
      : "";
  const title = notGoingTip ? `${main}${notGoingTip}`.trim() : undefined;

  if (!main && !notGoingTip) {
    return <span className="text-xs font-bold text-[#666666]">No responses yet</span>;
  }

  return (
    <span className="text-xs font-bold text-[#666666]" title={title}>
      {main}
    </span>
  );
}

export default function RsvpButtons({
  currentUserId,
  itineraryItemId,
  itemType,
  summary: summaryProp,
  variant = "full",
}: RsvpButtonsProps) {
  void itemType;
  const canRsvp = Boolean(currentUserId);
  const { setRsvp, rsvps, summary: liveSummary } = useEventRsvps({
    enabled: canRsvp,
    itineraryItemId,
    currentUserId,
  });

  const summary: RsvpSummary =
    canRsvp ? liveSummary : (summaryProp ?? { going: 0, interested: 0, not_going: 0, userStatus: null });
  const goingCount = summary.going;
  const userStatus = "userStatus" in summary ? summary.userStatus : null;

  if (variant === "compact") {
    if (goingCount === 0) {
      return null;
    }

    return (
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 border-2 border-[#1040C0] bg-[#1040C0]/10 px-2 py-0.5 text-xs font-bold text-[#1040C0]"
          title={`${goingCount} going`}
        >
          <span aria-hidden="true">✓</span>
          {goingCount}
        </span>
        {canRsvp && goingCount > 0 ? (
          <RsvpGoingAvatars rsvps={rsvps} variant="compact" />
        ) : null}
      </span>
    );
  }

  const handleClick = (status: RsvpStatus) => {
    if (!canRsvp) return;
    const next = userStatus === status ? null : status;
    void setRsvp(next);
  };

  return (
    <div className="space-y-2">
      {canRsvp ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="RSVP">
          <button
            type="button"
            onClick={() => handleClick("going")}
            className={[
              "inline-flex min-h-9 items-center gap-1.5 border-2 px-3 py-1.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#D02020]/30",
              userStatus === "going"
                ? "border-[#1040C0] bg-[#1040C0]/15 text-[#1040C0]"
                : "border-[#121212] bg-white text-[#121212] hover:border-[#1040C0] hover:bg-[#1040C0]/10 hover:text-[#1040C0]",
            ].join(" ")}
            aria-pressed={userStatus === "going"}
          >
            <span aria-hidden="true">✓</span>
            {RSVP_LABELS.going}
          </button>
          <button
            type="button"
            onClick={() => handleClick("interested")}
            className={[
              "inline-flex min-h-9 items-center gap-1.5 border-2 px-3 py-1.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#D02020]/30",
              userStatus === "interested"
                ? "border-[#F0C020] bg-[#F0C020]/15 text-[#946800]"
                : "border-[#121212] bg-white text-[#121212] hover:border-[#F0C020] hover:bg-[#F0C020]/10 hover:text-[#946800]",
            ].join(" ")}
            aria-pressed={userStatus === "interested"}
          >
            <span aria-hidden="true">★</span>
            {RSVP_LABELS.interested}
          </button>
          <button
            type="button"
            onClick={() => handleClick("not_going")}
            className={[
              "inline-flex min-h-9 items-center gap-1.5 border-2 px-3 py-1.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#D02020]/30",
              userStatus === "not_going"
                ? "border-[#121212] bg-[#F8F8F8] text-[#666666]"
                : "border-[#121212] bg-white text-[#121212] hover:bg-[#F8F8F8]",
            ].join(" ")}
            aria-pressed={userStatus === "not_going"}
          >
            <span aria-hidden="true">✕</span>
            {RSVP_LABELS.not_going}
          </button>
        </div>
      ) : null}
      {canRsvp && goingCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <RsvpGoingAvatars rsvps={rsvps} variant="full" />
        </div>
      ) : null}
      <CountsLine summary={summary} showNotGoingTooltip={canRsvp} />
    </div>
  );
}
