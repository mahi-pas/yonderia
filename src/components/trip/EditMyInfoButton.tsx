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
        className="group w-full rounded-[1.85rem] border border-[#f0c8b7] bg-[linear-gradient(180deg,#fff8f3,#fff1e7)] p-5 text-left shadow-[0_18px_40px_rgba(120,58,30,0.10)] transition hover:border-[#d98e6d] hover:shadow-[0_20px_45px_rgba(120,58,30,0.14)] focus:outline-none focus:ring-4 focus:ring-[#ffe0d1]"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">
              Your trip details
            </p>
            <h2 className="font-display text-3xl leading-none text-[#34180f]">
              {hasTravelDetails ? "Update your info" : "Set your travel details"}
            </h2>
            <p className="text-sm leading-6 text-[#6f4a3b]">
              {summary || "Add your nickname, arrival, and departure details so the crew knows your plan."}
            </p>
          </div>

          <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddb39f] bg-white/90 px-4 py-2 text-sm font-semibold text-[#5a2b1c] shadow-sm transition group-hover:border-[#c67b5a] group-hover:bg-[#fff7f1]">
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
