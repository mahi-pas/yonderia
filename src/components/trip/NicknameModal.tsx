"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";

type NicknameModalProps = {
  isOpen: boolean;
  onComplete: () => void;
  participantId: string;
  tripId: string;
};

function normalizeOptionalText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeOptionalTimestamp(value: string): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

export default function NicknameModal({
  isOpen,
  onComplete,
  participantId,
  tripId,
}: NicknameModalProps) {
  const [nickname, setNickname] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [arrivalLocation, setArrivalLocation] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [departureLocation, setDepartureLocation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const updates = {
        arrival_location: normalizeOptionalText(arrivalLocation),
        arrival_time: normalizeOptionalTimestamp(arrivalTime),
        departure_location: normalizeOptionalText(departureLocation),
        departure_time: normalizeOptionalTimestamp(departureTime),
        nickname: normalizeOptionalText(nickname),
      };

      const participantUpdateQuery = supabase.from("trip_participants");
      const { error } = await participantUpdateQuery
        // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
        .update(updates)
        .eq("id", participantId)
        .eq("trip_id", tripId);

      if (error) {
        throw error;
      }

      onComplete();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't save your trip details right now.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      description="This is just for this trip, so your crew can recognize you and know when you're getting in or heading out."
      isOpen={isOpen}
      onClose={() => {
        if (!isSaving) {
          onComplete();
        }
      }}
      panelClassName="sm:max-w-2xl"
      title="What should people call you on this trip?"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            disabled={isSaving}
            variant="ghost"
            onClick={() => {
              onComplete();
            }}
          >
            Skip
          </Button>
          <Button
            isLoading={isSaving}
            size="lg"
            onClick={() => {
              void handleSave();
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-6">
        <Input
          disabled={isSaving}
          hint="Trip nicknames are separate from your profile name."
          label="What should people call you on this trip?"
          maxLength={60}
          placeholder="Mahi, MJ, Snack Captain..."
          value={nickname}
          onChange={(event) => {
            setNickname(event.target.value);
          }}
        />

        <section className="space-y-4 rounded-[1.6rem] border border-[#efd5c8] bg-white/80 p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-semibold text-[#34180f]">When are you arriving?</h3>
            <p className="mt-1 text-sm leading-6 text-[#6f4a3b]">
              Add a date, time, and where you&apos;re landing or meeting up.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              disabled={isSaving}
              label="Arrival date and time"
              type="datetime-local"
              value={arrivalTime}
              onChange={(event) => {
                setArrivalTime(event.target.value);
              }}
            />
            <Input
              disabled={isSaving}
              label="Arrival location"
              placeholder="JFK Airport"
              value={arrivalLocation}
              onChange={(event) => {
                setArrivalLocation(event.target.value);
              }}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-[1.6rem] border border-[#efd5c8] bg-white/80 p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-semibold text-[#34180f]">When are you leaving?</h3>
            <p className="mt-1 text-sm leading-6 text-[#6f4a3b]">
              Share your departure timing and the place you&apos;re heading out from.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              disabled={isSaving}
              label="Departure date and time"
              type="datetime-local"
              value={departureTime}
              onChange={(event) => {
                setDepartureTime(event.target.value);
              }}
            />
            <Input
              disabled={isSaving}
              label="Departure location"
              placeholder="LAX Airport"
              value={departureLocation}
              onChange={(event) => {
                setDepartureLocation(event.target.value);
              }}
            />
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-[1.25rem] border border-[#efb9a3] bg-[#fff1ea] px-4 py-3 text-sm text-[#8b3f22]">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
