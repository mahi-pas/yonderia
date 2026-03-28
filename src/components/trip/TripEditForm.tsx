"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ImageUploader from "@/components/ui/ImageUploader";
import Input, { inputClassName } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types";
import TripLocationInput from "./TripLocationInput";

type TripEditFormProps = {
  canDeleteTrip?: boolean;
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

const DELETE_CONFIRM_WORD = "delete";

export default function TripEditForm({ canDeleteTrip = false, initialTrip, tripId }: TripEditFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const imageStateRef = useRef<ImageState | null>(createInitialImageState(initialTrip.imageUrl));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(() => createInitialFormState(initialTrip));
  const [imageState, setImageState] = useState<ImageState | null>(() => createInitialImageState(initialTrip.imageUrl));
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const formBusy = isSubmitting || isDeleting;
  const deleteConfirmed = deleteConfirmText.trim().toLowerCase() === DELETE_CONFIRM_WORD;

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

    if (isDeleting) {
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

  const handleDeleteTrip = async () => {
    if (!deleteConfirmed || !canDeleteTrip) {
      return;
    }

    setIsDeleting(true);
    setDeleteErrorMessage(null);

    try {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);

      if (error) {
        throw error;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setDeleteErrorMessage(error instanceof Error ? error.message : "We couldn't delete this trip right now.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="page-bg min-h-screen bg-[#F0F0F0] px-4 py-5 pb-24 sm:px-6 sm:py-7 sm:pb-7 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <section className="border-2 border-[#121212] bg-white p-5 shadow-[4px_4px_0px_0px_black] sm:border-4 sm:p-7 sm:shadow-[8px_8px_0px_0px_black]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Edit trip</p>
              <h1 className="text-4xl uppercase tracking-tighter font-black leading-[0.9] text-[#121212] sm:text-5xl">Update the plan</h1>
              <p className="max-w-2xl text-sm font-bold leading-6 text-[#888888] sm:text-base">
                Change the trip details, swap the header image, and keep everyone aligned on the latest version.
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center border-2 border-[#121212] bg-[#F8F8F8] px-4 py-3 text-sm font-bold text-[#888888] transition hover:border-[#D02020] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#D02020]/30"
              href={`/trip/${tripId}/customize`}
            >
              Customize Theme
            </Link>
          </div>

          <div className="mt-8 space-y-6">
            <Input
              disabled={formBusy}
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
              disabled={formBusy}
              initialImageUrl={imageState?.publicUrl ?? initialTrip.imageUrl}
              pathPrefix={`${tripId}/header`}
              onChange={setUploadedImageState}
              onUploadingChange={setIsImageUploading}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                disabled={formBusy}
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
                disabled={formBusy}
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
              disabled={formBusy}
              value={formState.location}
              onChange={(location) => {
                setFormState((current) => ({
                  ...current,
                  location,
                }));
              }}
            />

            <label className="block space-y-2">
              <span className="block text-sm font-bold uppercase tracking-widest text-[#121212]">Description</span>
              <textarea
                className={inputClassName("min-h-36 resize-none")}
                disabled={formBusy}
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
              <div className="border-2 border-[#D02020] bg-[#D02020]/10 px-4 py-3 text-sm font-bold text-[#D02020]">
                {errorMessage}
              </div>
            ) : null}

            <div className="sticky bottom-3 z-10 -mx-1 flex flex-col-reverse gap-3 border-2 border-[#121212] bg-white p-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pt-2">
              <Button
                disabled={formBusy}
                className="w-full sm:w-auto"
                variant="secondary"
                onClick={() => {
                  router.push(`/trip/${tripId}`);
                }}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                isLoading={isSubmitting}
                size="lg"
                onClick={() => {
                  void handleSubmit();
                }}
              >
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </div>

            {canDeleteTrip ? (
              <div className="mt-10 border-t-2 border-[#121212] pt-8">
                <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Danger zone</p>
                <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[#888888]">
                  Delete this trip permanently. Everyone loses access and all itinerary data is removed. This cannot be
                  undone.
                </p>
                {!showDeletePanel ? (
                  <Button
                    className="mt-4 border-[#D02020] bg-white text-[#D02020] hover:bg-[#D02020]/10"
                    variant="outline"
                    onClick={() => {
                      setShowDeletePanel(true);
                      setDeleteErrorMessage(null);
                    }}
                  >
                    Delete trip
                  </Button>
                ) : (
                  <div className="mt-4 space-y-4">
                    <Input
                      aria-label="Type delete to confirm"
                      disabled={formBusy}
                      hint="Any capitalization is fine (e.g. DELETE or Delete)."
                      label='Type "delete" to confirm'
                      value={deleteConfirmText}
                      onChange={(event) => {
                        setDeleteConfirmText(event.target.value);
                        setDeleteErrorMessage(null);
                      }}
                    />
                    {deleteErrorMessage ? (
                      <div className="border-2 border-[#D02020] bg-[#D02020]/10 px-4 py-3 text-sm font-bold text-[#D02020]">
                        {deleteErrorMessage}
                      </div>
                    ) : null}
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                      <Button
                        disabled={formBusy}
                        variant="secondary"
                        onClick={() => {
                          setShowDeletePanel(false);
                          setDeleteConfirmText("");
                          setDeleteErrorMessage(null);
                        }}
                      >
                        Cancel delete
                      </Button>
                      <Button
                        className="border-[#D02020] bg-[#D02020] text-white hover:opacity-90 focus:ring-[#D02020]/40"
                        disabled={!deleteConfirmed || formBusy}
                        isLoading={isDeleting}
                        onClick={() => {
                          void handleDeleteTrip();
                        }}
                      >
                        Permanently delete trip
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
