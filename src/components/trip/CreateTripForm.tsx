"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ImageUploader from "@/components/ui/ImageUploader";
import Input, { inputClassName } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types";
import TripLocationInput from "./TripLocationInput";

type CreateTripFormProps = {
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

export default function CreateTripForm({ currentUserId }: CreateTripFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const imageStateRef = useRef<ImageState | null>(null);
  const [draftTripId] = useState<string>(createDraftTripId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(createEmptyFormState);
  const [imageState, setImageState] = useState<ImageState | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="space-y-6">
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
        <span className="block text-sm font-medium text-[var(--foreground)]">Description</span>
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
        <div className="rounded-xl border border-[var(--error)] bg-[var(--error)]/15 px-4 py-3 text-sm text-[var(--error)]">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex justify-end pt-2">
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
    </div>
  );
}
