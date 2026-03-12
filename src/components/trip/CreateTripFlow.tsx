"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ImageUploader from "@/components/ui/ImageUploader";
import Input, { inputClassName } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types";
import TripLocationInput from "./TripLocationInput";

type CreateTripFlowProps = {
  currentUserId: string;
};

type LocationState = {
  latitude: number | null;
  longitude: number | null;
  name: string;
};

type ImageState = {
  path: string;
  publicUrl: string;
};

type FormState = {
  description: string;
  endDate: string;
  location: LocationState;
  name: string;
  startDate: string;
};

function createEmptyFormState(): FormState {
  return {
    description: "",
    endDate: "",
    location: {
      latitude: null,
      longitude: null,
      name: "",
    },
    name: "",
    startDate: "",
  };
}

function createDraftTripId(): string {
  return crypto.randomUUID();
}

function sanitizeSingleLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export default function CreateTripFlow({ currentUserId }: CreateTripFlowProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const imageStateRef = useRef<ImageState | null>(null);
  const [draftTripId, setDraftTripId] = useState<string>(createDraftTripId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(createEmptyFormState);
  const [imageState, setImageState] = useState<ImageState | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setDraftTripId(createDraftTripId());
    setErrorMessage(null);
    setFormState(createEmptyFormState());
    imageStateRef.current = null;
    setImageState(null);
    setIsImageUploading(false);
  };

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsOpen(false);
    resetForm();
  };

  const openModal = () => {
    resetForm();
    setIsOpen(true);
  };

  const setUploadedImageState = (value: ImageState | null) => {
    imageStateRef.current = value;
    setImageState(value);
  };

  const handleSubmit = async () => {
    const tripName = sanitizeSingleLine(formState.name);
    const tripLocation = sanitizeSingleLine(formState.location.name);
    const tripDescription = formState.description.trim();

    if (!tripName) {
      setErrorMessage("Give your trip a name before you create it.");
      return;
    }

    if (!formState.startDate || !formState.endDate) {
      setErrorMessage("Choose both a start and end date.");
      return;
    }

    if (formState.endDate < formState.startDate) {
      setErrorMessage("Your trip can't end before it starts.");
      return;
    }

    if (isImageUploading) {
      setErrorMessage("Your cover image is still uploading. Give it a second.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const uploadedImage = imageStateRef.current;
    const newTrip: Database["public"]["Tables"]["trips"]["Insert"] = {
      created_by: currentUserId,
      default_planner_permission: false,
      description: tripDescription || null,
      end_date: formState.endDate,
      id: draftTripId,
      image_url: uploadedImage?.publicUrl ?? null,
      latitude: formState.location.latitude,
      location_name: tripLocation || null,
      longitude: formState.location.longitude,
      name: tripName,
      start_date: formState.startDate,
    };

    const newParticipant: Database["public"]["Tables"]["trip_participants"]["Insert"] = {
      arrival_location: null,
      arrival_time: null,
      departure_location: null,
      departure_time: null,
      id: crypto.randomUUID(),
      nickname: null,
      role: "organizer",
      trip_id: draftTripId,
      user_id: currentUserId,
    };

    try {
      // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
      const { error: tripError } = await supabase.from("trips").insert(newTrip);

      if (tripError) {
        throw tripError;
      }

      // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
      const { error: participantError } = await supabase.from("trip_participants").insert(newParticipant);

      if (participantError) {
        await supabase.from("trips").delete().eq("id", draftTripId);
        throw participantError;
      }

      setIsOpen(false);
      router.push(`/trip/${draftTripId}/participants?tab=invites`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't create that trip right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        className="group flex min-h-[18rem] w-full flex-col justify-between rounded-2xl border border-dashed border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(20,20,31,0.92),rgba(10,10,15,0.96))] p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15)] transition-all duration-300 hover:-translate-y-px hover:border-[#8b5cf6]/50 hover:shadow-[0_4px_32px_rgba(139,92,246,0.15),0_8px_32px_rgba(0,0,0,0.25)]"
        type="button"
        onClick={openModal}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[image:var(--accent-gradient)] text-3xl text-white shadow-[0_2px_20px_rgba(139,92,246,0.3)] transition">
          +
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide uppercase gradient-text">
            Start planning
          </p>
          <h3 className="font-display text-3xl leading-none text-[#fafafa]">Create New Trip</h3>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Pick the dates, drop in a dreamy cover image, and get invite links ready in one go.
          </p>
        </div>
      </button>

      <Modal
        description="Give your trip a name, dates, a place, and a photo so your crew lands on something that already feels real."
        isOpen={isOpen}
        onClose={closeModal}
        panelClassName="sm:max-w-4xl"
        title="Create a trip"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button disabled={isSubmitting} variant="secondary" onClick={closeModal}>
              Maybe later
            </Button>
            <Button
              isLoading={isSubmitting}
              size="lg"
              onClick={() => {
                void handleSubmit();
              }}
            >
              {isSubmitting ? "Creating trip..." : "Create trip"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6 pb-10">
          <Input
            disabled={isSubmitting}
            label="Trip name"
            maxLength={100}
            placeholder="Summer in Lisbon"
            value={formState.name}
            onChange={(event) => {
              setFormState((current) => ({
                ...current,
                name: event.target.value,
              }));
            }}
          />

          <ImageUploader
            bucket="trip-images"
            disabled={isSubmitting}
            initialImageUrl={imageState?.publicUrl ?? null}
            pathPrefix={`${draftTripId}/header`}
            onChange={setUploadedImageState}
            onUploadingChange={setIsImageUploading}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              disabled={isSubmitting}
              label="Start date"
              type="date"
              value={formState.startDate}
              onChange={(event) => {
                setFormState((current) => ({
                  ...current,
                  startDate: event.target.value,
                }));
              }}
            />
            <Input
              disabled={isSubmitting}
              label="End date"
              type="date"
              value={formState.endDate}
              onChange={(event) => {
                setFormState((current) => ({
                  ...current,
                  endDate: event.target.value,
                }));
              }}
            />
          </div>

          <TripLocationInput
            disabled={isSubmitting}
            value={formState.location}
            onChange={(location) => {
              setFormState((current) => ({
                ...current,
                location,
              }));
            }}
          />

          <label className="block space-y-2">
            <span className="block text-sm font-medium text-[#d4d4d8]">Description</span>
            <textarea
              className={inputClassName("min-h-36 resize-none")}
              disabled={isSubmitting}
              maxLength={1000}
              placeholder="What kind of trip is this? Drop in the vibe, the plan, or the notes your group should know."
              value={formState.description}
              onChange={(event) => {
                setFormState((current) => ({
                  ...current,
                  description: event.target.value,
                }));
              }}
            />
          </label>

          {errorMessage ? (
            <div className="rounded-xl border border-[#ef4444]/30 bg-[#450a0a]/90 px-4 py-3 text-sm text-[#fca5a5]">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
