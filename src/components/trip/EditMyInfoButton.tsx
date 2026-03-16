"use client";

import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import NicknameModal from "@/components/trip/NicknameModal";

type EditMyInfoButtonProps = {
  initialValues: {
    arrivalLocation: string | null;
    arrivalTime: string | null;
    departureLocation: string | null;
    departureTime: string | null;
    nickname: string | null;
  };
  participantId: string;
  tripId: string;
};

function formatTravelMoment(prefix: string, time: string | null, location: string | null): string | null {
  const trimmedLocation = location?.trim() ?? "";

  if (time) {
    const parsed = parseISO(time);

    if (isValid(parsed)) {
      return trimmedLocation
        ? `${prefix} ${format(parsed, "EEE h:mmaaa")} at ${trimmedLocation}`
        : `${prefix} ${format(parsed, "EEE h:mmaaa")}`;
    }
  }

  if (trimmedLocation) {
    return `${prefix} at ${trimmedLocation}`;
  }

  return null;
}

export default function EditMyInfoButton({
  initialValues,
  participantId,
  tripId,
}: EditMyInfoButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const arrivalSummary = formatTravelMoment(
    "Arriving",
    initialValues.arrivalTime,
    initialValues.arrivalLocation,
  );
  const departureSummary = formatTravelMoment(
    "Leaving",
    initialValues.departureTime,
    initialValues.departureLocation,
  );
  const hasTravelDetails = Boolean(
    initialValues.arrivalTime ||
      initialValues.arrivalLocation ||
      initialValues.departureTime ||
      initialValues.departureLocation,
  );
  const summary = [arrivalSummary, departureSummary].filter(Boolean).join(" · ");

  return (
    <>
      <button
        className="group w-full rounded-xl border border-[var(--border)] p-5 text-left transition hover:border-[var(--accent)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
              Your trip details
            </p>
            <h2 className="font-display text-3xl leading-none text-[var(--foreground)]">
              {hasTravelDetails ? "Update your info" : "Set your travel details"}
            </h2>
            <p className="text-sm leading-6 text-[var(--foreground)]/90">
              {summary || "Add your nickname, arrival, and departure details so the crew knows your plan."}
            </p>
          </div>

          <span className="inline-flex min-h-11 items-center justify-center rounded-md bg-[image:var(--accent-gradient)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition group-hover:brightness-110">
            {hasTravelDetails ? "Update info" : "Set details"}
          </span>
        </div>
      </button>

      <NicknameModal
        cancelLabel="Cancel"
        description="Update the trip-specific details your crew sees for this plan."
        initialValues={initialValues}
        isOpen={isOpen}
        participantId={participantId}
        submitLabel="Save changes"
        title="Edit your trip details"
        tripId={tripId}
        onComplete={() => {
          setIsOpen(false);
        }}
        onSaved={() => {
          router.refresh();
        }}
      />
    </>
  );
}
