"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ImageUploader from "@/components/ui/ImageUploader";
import Input, { inputClassName } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types";
import TripLocationInput from "./TripLocationInput";

type TripEditFormProps = {
  initialTrip: {
    description: string | null;
    endDate: string;
    imageUrl: string | null;
    location: {
      latitude: number | null;
      longitude: number | null;
      name: string;
    };
    name: string;
    startDate: string;
  };
  tripId: string;
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

function sanitizeSingleLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function createInitialFormState(initialTrip: TripEditFormProps["initialTrip"]): FormState {
  return {
    description: initialTrip.description ?? "",
    endDate: initialTrip.endDate,
    location: {
      latitude: initialTrip.location.latitude,
      longitude: initialTrip.location.longitude,
      name: initialTrip.location.name,
    },
    name: initialTrip.name,
    startDate: initialTrip.startDate,
  };
}

function createInitialImageState(imageUrl: string | null): ImageState | null {
  if (!imageUrl) {
    return null;
  }

  return {
    path: "",
    publicUrl: imageUrl,
  };
}

export default function TripEditForm({ initialTrip, tripId }: TripEditFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const imageStateRef = useRef<ImageState | null>(createInitialImageState(initialTrip.imageUrl));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(() => createInitialFormState(initialTrip));
  const [imageState, setImageState] = useState<ImageState | null>(() => createInitialImageState(initialTrip.imageUrl));
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
      setErrorMessage("Give your trip a name before you save it.");
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
    const updates: Database["public"]["Tables"]["trips"]["Update"] = {
      description: tripDescription || null,
      end_date: formState.endDate,
      image_url: uploadedImage?.publicUrl ?? null,
      latitude: formState.location.latitude,
      location_name: tripLocation || null,
      longitude: formState.location.longitude,
      name: tripName,
      start_date: formState.startDate,
    };

    try {
      const { error } = await supabase
        .from("trips")
        // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
        .update(updates)
        .eq("id", tripId);

      if (error) {
        throw error;
      }

      router.push(`/trip/${tripId}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't save that trip right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffe1d0_0%,#fff8f4_42%,#fff6ef_100%)] px-4 py-5 sm:px-6 sm:py-7 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,250,246,0.95),rgba(255,245,237,0.92))] p-5 shadow-[0_28px_90px_rgba(104,45,20,0.12)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Edit trip</p>
              <h1 className="font-display text-4xl leading-none text-[#34180f] sm:text-5xl">Update the plan</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#6f4a3b] sm:text-base">
                Change the trip details, swap the header image, and keep everyone aligned on the latest version.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
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
              initialImageUrl={imageState?.publicUrl ?? initialTrip.imageUrl}
              pathPrefix={`${tripId}/header`}
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
              <span className="block text-sm font-semibold text-[#5a2b1c]">Description</span>
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
              <div className="rounded-[1.25rem] border border-[#efb9a3] bg-[#fff1ea] px-4 py-3 text-sm text-[#8b3f22]">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button
                disabled={isSubmitting}
                variant="secondary"
                onClick={() => {
                  router.push(`/trip/${tripId}`);
                }}
              >
                Cancel
              </Button>
              <Button
                isLoading={isSubmitting}
                size="lg"
                onClick={() => {
                  void handleSubmit();
                }}
              >
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
