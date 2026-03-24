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
        className="group w-full border-2 border-[#121212] bg-white p-5 text-left shadow-[4px_4px_0px_0px_black] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none focus:outline-none focus:ring-2 focus:ring-[#D02020]/30"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#121212]">
              Your trip details
            </p>
            <h2 className="text-3xl uppercase tracking-tighter font-black leading-[0.9] text-[#121212]">
              {hasTravelDetails ? "Update your info" : "Set your travel details"}
            </h2>
            <p className="text-sm font-bold leading-6 text-[#121212]/90">
              {summary || "Add your nickname, arrival, and departure details so the crew knows your plan."}
            </p>
          </div>

          <span className="inline-flex min-h-11 items-center justify-center bg-[#D02020] px-4 py-2 text-sm font-bold uppercase tracking-widest text-white shadow-[2px_2px_0px_0px_black] transition group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-none">
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
