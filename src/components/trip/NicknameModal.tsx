"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";

type NicknameModalInitialValues = {
  arrivalLocation?: string | null;
  arrivalTime?: string | null;
  departureLocation?: string | null;
  departureTime?: string | null;
  nickname?: string | null;
};

type NicknameModalProps = {
  cancelLabel?: string;
  description?: string;
  initialValues?: NicknameModalInitialValues;
  isOpen: boolean;
  onComplete: () => void;
  onSaved?: () => void;
  participantId: string;
  submitLabel?: string;
  title?: string;
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

function formatTimestampForInputParts(value: string | null | undefined): { date: string; time: string } {
  if (!value) {
    return {
      date: "",
      time: "",
    };
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      date: "",
      time: "",
    };
  }

  const pad = (segment: number) => String(segment).padStart(2, "0");

  return {
    date: `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`,
    time: `${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`,
  };
}

function getDateTimeValue(date: string, time: string): string | null {
  if (!date && !time) {
    return null;
  }

  if (!date || !time) {
    return "__incomplete__";
  }

  return normalizeOptionalTimestamp(`${date}T${time}`);
}

function ClearFieldButton({
  disabled,
  isVisible,
  onClick,
}: {
  disabled: boolean;
  isVisible: boolean;
  onClick: () => void;
}) {
  if (!isVisible) {
    return null;
  }

  return (
    <button
      className="text-sm font-semibold text-[#b24f2d] transition hover:text-[#8d3e23] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      Clear
    </button>
  );
}

function FieldHeader({
  disabled,
  isClearVisible,
  label,
  onClear,
}: {
  disabled: boolean;
  isClearVisible: boolean;
  label: string;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="block text-sm font-semibold text-[#5a2b1c]">{label}</span>
      <ClearFieldButton disabled={disabled} isVisible={isClearVisible} onClick={onClear} />
    </div>
  );
}

export default function NicknameModal({
  cancelLabel = "Skip",
  description = "This is just for this trip, so your crew can recognize you and know when you're getting in or heading out.",
  initialValues,
  isOpen,
  onComplete,
  onSaved,
  participantId,
  submitLabel = "Save",
  title = "What should people call you on this trip?",
  tripId,
}: NicknameModalProps) {
  const [nickname, setNickname] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [arrivalLocation, setArrivalLocation] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [departureLocation, setDepartureLocation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setNickname(initialValues?.nickname ?? "");
    const initialArrival = formatTimestampForInputParts(initialValues?.arrivalTime);
    const initialDeparture = formatTimestampForInputParts(initialValues?.departureTime);
    setArrivalDate(initialArrival.date);
    setArrivalTime(initialArrival.time);
    setArrivalLocation(initialValues?.arrivalLocation ?? "");
    setDepartureDate(initialDeparture.date);
    setDepartureTime(initialDeparture.time);
    setDepartureLocation(initialValues?.departureLocation ?? "");
    setErrorMessage(null);
  }, [initialValues, isOpen]);

  const handleSave = async () => {
    setErrorMessage(null);

    const normalizedArrivalTime = getDateTimeValue(arrivalDate, arrivalTime);
    const normalizedDepartureTime = getDateTimeValue(departureDate, departureTime);

    if (normalizedArrivalTime === "__incomplete__") {
      setErrorMessage("Choose both an arrival date and time, or clear the field.");
      return;
    }

    if (normalizedDepartureTime === "__incomplete__") {
      setErrorMessage("Choose both a departure date and time, or clear the field.");
      return;
    }

    if (
      normalizedArrivalTime &&
      normalizedDepartureTime &&
      new Date(normalizedDepartureTime).getTime() <= new Date(normalizedArrivalTime).getTime()
    ) {
      setErrorMessage("Departure must be after arrival.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      const updates = {
        arrival_location: normalizeOptionalText(arrivalLocation),
        arrival_time: normalizedArrivalTime,
        departure_location: normalizeOptionalText(departureLocation),
        departure_time: normalizedDepartureTime,
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

      onSaved?.();
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
      description={description}
      isOpen={isOpen}
      onClose={() => {
        if (!isSaving) {
          onComplete();
        }
      }}
      panelClassName="sm:max-w-2xl"
      title={title}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            disabled={isSaving}
            variant="ghost"
            onClick={() => {
              onComplete();
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            isLoading={isSaving}
            size="lg"
            onClick={() => {
              void handleSave();
            }}
          >
            {isSaving ? "Saving..." : submitLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-6">
        <label className="block space-y-2">
          <FieldHeader
            disabled={isSaving}
            isClearVisible={nickname.trim().length > 0}
            label="What should people call you on this trip?"
            onClear={() => {
              setNickname("");
            }}
          />
          <input
            aria-label="Trip nickname"
            className={inputClassName()}
            disabled={isSaving}
            maxLength={60}
            placeholder="Mahi, MJ, Snack Captain..."
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
            }}
          />
          <span className="block text-sm text-[#8b675a]">Trip nicknames are separate from your profile name.</span>
        </label>

        <section className="space-y-4 rounded-[1.6rem] border border-[#efd5c8] bg-white/80 p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-semibold text-[#34180f]">When are you arriving?</h3>
            <p className="mt-1 text-sm leading-6 text-[#6f4a3b]">
              Add a date, time, and where you&apos;re landing or meeting up.
            </p>
          </div>

          <div className="space-y-2">
            <FieldHeader
              disabled={isSaving}
              isClearVisible={Boolean(arrivalDate || arrivalTime)}
              label="Arrival date and time"
              onClear={() => {
                setArrivalDate("");
                setArrivalTime("");
              }}
            />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <input
                aria-label="Arrival date"
                className={inputClassName()}
                disabled={isSaving}
                type="date"
                value={arrivalDate}
                onChange={(event) => {
                  setArrivalDate(event.target.value);
                }}
              />
              <input
                aria-label="Arrival time"
                className={inputClassName()}
                disabled={isSaving}
                type="time"
                value={arrivalTime}
                onChange={(event) => {
                  setArrivalTime(event.target.value);
                }}
              />
            </div>
            <p className="text-sm text-[#8b675a]">Use the date and time pickers to share your arrival plan.</p>
          </div>

          <label className="block space-y-2">
            <FieldHeader
              disabled={isSaving}
              isClearVisible={arrivalLocation.trim().length > 0}
              label="Arrival location"
              onClear={() => {
                setArrivalLocation("");
              }}
            />
            <input
              aria-label="Arrival location"
              className={inputClassName()}
              disabled={isSaving}
              placeholder="e.g., JFK Airport, Airbnb address"
              value={arrivalLocation}
              onChange={(event) => {
                setArrivalLocation(event.target.value);
              }}
            />
          </label>
        </section>

        <section className="space-y-4 rounded-[1.6rem] border border-[#efd5c8] bg-white/80 p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-semibold text-[#34180f]">When are you leaving?</h3>
            <p className="mt-1 text-sm leading-6 text-[#6f4a3b]">
              Share your departure timing and the place you&apos;re heading out from.
            </p>
          </div>

          <div className="space-y-2">
            <FieldHeader
              disabled={isSaving}
              isClearVisible={Boolean(departureDate || departureTime)}
              label="Departure date and time"
              onClear={() => {
                setDepartureDate("");
                setDepartureTime("");
              }}
            />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <input
                aria-label="Departure date"
                className={inputClassName()}
                disabled={isSaving}
                type="date"
                value={departureDate}
                onChange={(event) => {
                  setDepartureDate(event.target.value);
                }}
              />
              <input
                aria-label="Departure time"
                className={inputClassName()}
                disabled={isSaving}
                type="time"
                value={departureTime}
                onChange={(event) => {
                  setDepartureTime(event.target.value);
                }}
              />
            </div>
            <p className="text-sm text-[#8b675a]">Use the date and time pickers to share when you&apos;re heading out.</p>
          </div>

          <label className="block space-y-2">
            <FieldHeader
              disabled={isSaving}
              isClearVisible={departureLocation.trim().length > 0}
              label="Departure location"
              onClear={() => {
                setDepartureLocation("");
              }}
            />
            <input
              aria-label="Departure location"
              className={inputClassName()}
              disabled={isSaving}
              placeholder="e.g., JFK Airport, Airbnb address"
              value={departureLocation}
              onChange={(event) => {
                setDepartureLocation(event.target.value);
              }}
            />
          </label>
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
