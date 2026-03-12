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
        className="group w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-sm transition hover:border-[#8b5cf6]/30 hover:shadow-[0_2px_8px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.3)] focus:outline-none focus:ring-4 focus:ring-[#8b5cf6]/30"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="gradient-text text-xs font-semibold uppercase tracking-wide">
              Your trip details
            </p>
            <h2 className="font-display text-3xl leading-none text-[#fafafa]">
              {hasTravelDetails ? "Update your info" : "Set your travel details"}
            </h2>
            <p className="text-sm leading-6 text-[#d4d4d8]">
              {summary || "Add your nickname, arrival, and departure details so the crew knows your plan."}
            </p>
          </div>

          <span className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)]/50 px-4 py-2 text-sm font-semibold text-[#d4d4d8] shadow-sm transition group-hover:border-[#8b5cf6] group-hover:text-[#8b5cf6]">
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
