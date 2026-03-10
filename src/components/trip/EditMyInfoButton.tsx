"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
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

export default function EditMyInfoButton({
  initialValues,
  participantId,
  tripId,
}: EditMyInfoButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setIsOpen(true)}>
          Edit my info
        </Button>
      </div>

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
