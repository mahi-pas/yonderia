import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import ImageUploader from "@/components/ui/ImageUploader";
import Input, { inputClassName } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import type { ItineraryItemType } from "@/lib/types";
import { formatDayLabel } from "@/lib/utils";
import type { ItineraryListItem } from "@/hooks/useItinerary";
import TripLocationInput from "./TripLocationInput";

type LocationState = {
  latitude: number | null;
  longitude: number | null;
  name: string;
};

type ImageState = {
  path: string;
  publicUrl: string;
};

type ImageSuggestion = {
  imageUrl: string;
  sourceUrl: string;
  title: string;
};

type AddEventModalProps = {
  currentUserId: string;
  dayDate: string;
  existingItems: ItineraryListItem[];
  isOpen: boolean;
  onClose: () => void;
  onCreated: (item: ItineraryListItem) => void;
  tripId: string;
};

type FormState = {
  commuteDepartureTime: string;
  commuteDestination: LocationState;
  commuteOrigin: LocationState;
  dayDate: string;
  description: string;
  eventLocation: LocationState;
  eventTime: string;
  hotelCheckInTime: string;
  hotelCheckOutTime: string;
  hotelLocation: LocationState;
  title: string;
};

const ITEM_TYPES: { id: ItineraryItemType; label: string }[] = [
  { id: "event", label: "Event" },
  { id: "hotel", label: "Hotel" },
  { id: "commute", label: "Commute" },
];

function createEmptyLocation(): LocationState {
  return {
    latitude: null,
    longitude: null,
    name: "",
  };
}

function createInitialFormState(dayDate: string): FormState {
  return {
    commuteDepartureTime: "",
    commuteDestination: createEmptyLocation(),
    commuteOrigin: createEmptyLocation(),
    dayDate,
    description: "",
    eventLocation: createEmptyLocation(),
    eventTime: "",
    hotelCheckInTime: "",
    hotelCheckOutTime: "",
    hotelLocation: createEmptyLocation(),
    title: "",
  };
}

function sanitizeSingleLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function combineDateAndTime(dayDate: string, time: string): string | null {
  if (!dayDate || !time) {
    return null;
  }

  return new Date(`${dayDate}T${time}:00`).toISOString();
}

function getNextSortOrder(items: ItineraryListItem[], dayDate: string): number {
  const dayItems = items.filter((item) => item.day_date === dayDate);

  if (dayItems.length === 0) {
    return 0;
  }

  return Math.max(...dayItems.map((item) => item.sort_order)) + 1;
}

function buildImageQuery(itemType: ItineraryItemType, formState: FormState): string {
  const parts =
    itemType === "event"
      ? [formState.title, formState.eventLocation.name]
      : itemType === "hotel"
        ? [formState.title, formState.hotelLocation.name, "hotel"]
        : [formState.title, formState.commuteOrigin.name, formState.commuteDestination.name];

  return parts
    .map((value) => sanitizeSingleLine(value))
    .filter(Boolean)
    .join(" ");
}

function getActiveLocationLabel(itemType: ItineraryItemType, formState: FormState): string {
  if (itemType === "hotel") {
    return formState.hotelLocation.name;
  }

  if (itemType === "commute") {
    return [formState.commuteOrigin.name, formState.commuteDestination.name].filter(Boolean).join(" to ");
  }

  return formState.eventLocation.name;
}

export default function AddEventModal({
  currentUserId,
  dayDate,
  existingItems,
  isOpen,
  onClose,
  onCreated,
  tripId,
}: AddEventModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const customImageRef = useRef<ImageState | null>(null);
  const [customImage, setCustomImage] = useState<ImageState | null>(null);
  const [draftItemId, setDraftItemId] = useState<string>(() => crypto.randomUUID());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(() => createInitialFormState(dayDate));
  const [imageSuggestions, setImageSuggestions] = useState<ImageSuggestion[]>([]);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [itemType, setItemType] = useState<ItineraryItemType>("event");
  const [selectedSuggestionUrl, setSelectedSuggestionUrl] = useState<string | null>(null);
  const [showCustomUploader, setShowCustomUploader] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    customImageRef.current = null;
    setCustomImage(null);
    setDraftItemId(crypto.randomUUID());
    setErrorMessage(null);
    setFormState(createInitialFormState(dayDate));
    setImageSuggestions([]);
    setIsImageUploading(false);
    setIsSaving(false);
    setIsSearchingImages(false);
    setItemType("event");
    setSelectedSuggestionUrl(null);
    setShowCustomUploader(false);
  }, [dayDate, isOpen]);

  useEffect(() => {
    if (!isOpen || showCustomUploader || customImageRef.current) {
      return;
    }

    const query = buildImageQuery(itemType, formState);

    if (sanitizeSingleLine(formState.title).length < 3) {
      setImageSuggestions([]);
      setSelectedSuggestionUrl(null);
      setIsSearchingImages(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setIsSearchingImages(true);
        const response = await fetch(`/api/images/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to fetch image suggestions.");
        }

        const data = (await response.json()) as { results?: ImageSuggestion[] };
        const nextSuggestions = data.results ?? [];
        setImageSuggestions(nextSuggestions);
        setSelectedSuggestionUrl((current) =>
          current && nextSuggestions.some((result) => result.imageUrl === current)
            ? current
            : (nextSuggestions[0]?.imageUrl ?? null),
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setImageSuggestions([]);
        setSelectedSuggestionUrl(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to fetch image suggestions right now.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingImages(false);
        }
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [formState, isOpen, itemType, showCustomUploader]);

  const selectedSuggestion =
    imageSuggestions.find((result) => result.imageUrl === selectedSuggestionUrl) ?? imageSuggestions[0] ?? null;
  const previewImageUrl = customImage?.publicUrl ?? selectedSuggestion?.imageUrl ?? null;
  const locationLabel = getActiveLocationLabel(itemType, formState);

  const handleSave = async () => {
    const title = sanitizeSingleLine(formState.title);

    if (!title) {
      setErrorMessage("Give this itinerary item a title first.");
      return;
    }

    if (isImageUploading) {
      setErrorMessage("Your custom image is still uploading. Give it a second.");
      return;
    }

    if (itemType === "event") {
      if (!formState.eventTime) {
        setErrorMessage("Add a time for this event.");
        return;
      }

      if (!sanitizeSingleLine(formState.eventLocation.name)) {
        setErrorMessage("Pick a location for this event.");
        return;
      }
    }

    if (itemType === "hotel" && !sanitizeSingleLine(formState.hotelLocation.name)) {
      setErrorMessage("Add the hotel location.");
      return;
    }

    if (itemType === "commute") {
      if (!formState.commuteDepartureTime) {
        setErrorMessage("Add a departure time for this commute.");
        return;
      }

      if (!sanitizeSingleLine(formState.commuteOrigin.name) || !sanitizeSingleLine(formState.commuteDestination.name)) {
        setErrorMessage("Add both the origin and destination.");
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage(null);

    const description = formState.description.trim();
    const eventStartTime = combineDateAndTime(formState.dayDate, formState.eventTime);
    const hotelCheckInTime = combineDateAndTime(formState.dayDate, formState.hotelCheckInTime);
    const hotelCheckOutTime = combineDateAndTime(formState.dayDate, formState.hotelCheckOutTime);
    const commuteDepartureTime = combineDateAndTime(formState.dayDate, formState.commuteDepartureTime);

    const nextItem = {
      created_by: currentUserId,
      day_date: formState.dayDate,
      description: description || null,
      destination_latitude: itemType === "commute" ? formState.commuteDestination.latitude : null,
      destination_longitude: itemType === "commute" ? formState.commuteDestination.longitude : null,
      destination_name:
        itemType === "commute" ? sanitizeSingleLine(formState.commuteDestination.name) || null : null,
      end_time: itemType === "hotel" ? hotelCheckOutTime : null,
      id: draftItemId,
      image_url: customImage?.publicUrl ?? selectedSuggestion?.imageUrl ?? null,
      item_type: itemType,
      latitude:
        itemType === "event"
          ? formState.eventLocation.latitude
          : itemType === "hotel"
            ? formState.hotelLocation.latitude
            : formState.commuteOrigin.latitude,
      location_name:
        itemType === "event"
          ? sanitizeSingleLine(formState.eventLocation.name) || null
          : itemType === "hotel"
            ? sanitizeSingleLine(formState.hotelLocation.name) || null
            : sanitizeSingleLine(formState.commuteOrigin.name) || null,
      longitude:
        itemType === "event"
          ? formState.eventLocation.longitude
          : itemType === "hotel"
            ? formState.hotelLocation.longitude
            : formState.commuteOrigin.longitude,
      sort_order: getNextSortOrder(existingItems, formState.dayDate),
      start_time:
        itemType === "event" ? eventStartTime : itemType === "hotel" ? hotelCheckInTime : commuteDepartureTime,
      title,
      trip_id: tripId,
    };

    try {
      // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
      const { error } = await supabase.from("itinerary_items").insert(nextItem);

      if (error) {
        throw error;
      }

      onCreated(nextItem);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't save that itinerary item right now.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      description={`Adding to ${formatDayLabel(formState.dayDate)}.`}
      isOpen={isOpen}
      onClose={() => {
        if (!isSaving) {
          onClose();
        }
      }}
      panelClassName="sm:max-w-4xl"
      title="Add to itinerary"
      footer={
        <div className="space-y-3">
          {errorMessage ? (
            <div className="rounded-[1.25rem] border border-[#efb9a3] bg-[#fff1ea] px-4 py-3 text-sm text-[#8b3f22]">
              {errorMessage}
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button disabled={isSaving} variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              isLoading={isSaving}
              size="lg"
              onClick={() => {
                void handleSave();
              }}
            >
              {isSaving ? "Saving..." : `Save ${ITEM_TYPES.find((type) => type.id === itemType)?.label ?? "item"}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 pb-10">
        <div className="inline-flex rounded-full border border-[#e7c4b3] bg-white/80 p-1">
          {ITEM_TYPES.map((type) => (
            <button
              key={type.id}
              className={[
                "min-h-11 rounded-full px-4 text-sm font-semibold transition",
                itemType === type.id
                  ? "bg-[#c76038] text-white shadow-[0_14px_32px_rgba(199,96,56,0.24)]"
                  : "text-[#6a3d2d] hover:bg-[#fff1ea]",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setItemType(type.id);
              }}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <Input
              disabled={isSaving}
              label="Title"
              maxLength={120}
              placeholder={
                itemType === "event"
                  ? "Sunset rooftop dinner"
                  : itemType === "hotel"
                    ? "Check in at Hotel Teatro"
                    : "Flight to Barcelona"
              }
              value={formState.title}
              onChange={(event) => {
                setErrorMessage(null);
                setFormState((current) => ({
                  ...current,
                  title: event.target.value,
                }));
              }}
            />

            <label className="block space-y-2">
              <span className="block text-sm font-semibold text-[#5a2b1c]">Description</span>
              <textarea
                className={inputClassName("min-h-28 resize-none")}
                disabled={isSaving}
                maxLength={800}
                placeholder="Add the key details your group should know."
                value={formState.description}
                onChange={(event) => {
                  setFormState((current) => ({
                    ...current,
                    description: event.target.value,
                  }));
                }}
              />
            </label>

            {itemType === "event" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    disabled={isSaving}
                    label="Date"
                    type="date"
                    value={formState.dayDate}
                    onChange={(event) => {
                      setFormState((current) => ({
                        ...current,
                        dayDate: event.target.value,
                      }));
                    }}
                  />
                  <Input
                    disabled={isSaving}
                    label="Time"
                    type="time"
                    value={formState.eventTime}
                    onChange={(event) => {
                      setFormState((current) => ({
                        ...current,
                        eventTime: event.target.value,
                      }));
                    }}
                  />
                </div>

                <TripLocationInput
                  disabled={isSaving}
                  label="Location"
                  value={formState.eventLocation}
                  onChange={(value) => {
                    setFormState((current) => ({
                      ...current,
                      eventLocation: value,
                    }));
                  }}
                />
              </>
            ) : null}

            {itemType === "hotel" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    disabled={isSaving}
                    hint="Optional"
                    label="Check-in time"
                    type="time"
                    value={formState.hotelCheckInTime}
                    onChange={(event) => {
                      setFormState((current) => ({
                        ...current,
                        hotelCheckInTime: event.target.value,
                      }));
                    }}
                  />
                  <Input
                    disabled={isSaving}
                    hint="Optional"
                    label="Check-out time"
                    type="time"
                    value={formState.hotelCheckOutTime}
                    onChange={(event) => {
                      setFormState((current) => ({
                        ...current,
                        hotelCheckOutTime: event.target.value,
                      }));
                    }}
                  />
                </div>

                <TripLocationInput
                  disabled={isSaving}
                  label="Location"
                  value={formState.hotelLocation}
                  onChange={(value) => {
                    setFormState((current) => ({
                      ...current,
                      hotelLocation: value,
                    }));
                  }}
                />
              </>
            ) : null}

            {itemType === "commute" ? (
              <>
                <Input
                  disabled={isSaving}
                  label="Departure time"
                  type="time"
                  value={formState.commuteDepartureTime}
                  onChange={(event) => {
                    setFormState((current) => ({
                      ...current,
                      commuteDepartureTime: event.target.value,
                    }));
                  }}
                />

                <TripLocationInput
                  disabled={isSaving}
                  label="Origin"
                  value={formState.commuteOrigin}
                  onChange={(value) => {
                    setFormState((current) => ({
                      ...current,
                      commuteOrigin: value,
                    }));
                  }}
                />

                <TripLocationInput
                  disabled={isSaving}
                  label="Destination"
                  value={formState.commuteDestination}
                  onChange={(value) => {
                    setFormState((current) => ({
                      ...current,
                      commuteDestination: value,
                    }));
                  }}
                />
              </>
            ) : null}
          </div>

          <div className="space-y-4 rounded-[1.75rem] border border-[#efd5c8] bg-white/70 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#5a2b1c]">Image</p>
              <p className="text-sm leading-6 text-[#8b675a]">
                Auto-suggested from your title{locationLabel ? ` and ${locationLabel}` : ""}.
              </p>
            </div>

            {previewImageUrl ? (
              <div className="overflow-hidden rounded-[1.4rem] border border-[#ecd0c2] bg-[#fff4ee]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={formState.title || "Suggested itinerary image"} className="h-48 w-full object-cover" src={previewImageUrl} />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-[1.4rem] border border-dashed border-[#dfb7a4] bg-[#fff6f1] px-4 text-center text-sm leading-6 text-[#8b675a]">
                Start with a title and we&apos;ll look for a matching image.
              </div>
            )}

            {showCustomUploader ? (
              <ImageUploader
                bucket="itinerary-images"
                disabled={isSaving}
                initialImageUrl={customImage?.publicUrl ?? null}
                label="Custom image"
                pathPrefix={draftItemId}
                onChange={(value) => {
                  customImageRef.current = value;
                  setCustomImage(value);
                  setShowCustomUploader(true);
                }}
                onUploadingChange={setIsImageUploading}
              />
            ) : (
              <div className="space-y-3">
                <Button
                  className="w-full"
                  disabled={isSaving}
                  variant="secondary"
                  onClick={() => {
                    customImageRef.current = null;
                    setCustomImage(null);
                    setShowCustomUploader(true);
                  }}
                >
                  Change image
                </Button>

                {isSearchingImages ? (
                  <p className="text-sm text-[#8b675a]">Finding image suggestions...</p>
                ) : null}

                {imageSuggestions.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {imageSuggestions.map((suggestion) => {
                      const isSelected = suggestion.imageUrl === selectedSuggestion?.imageUrl;

                      return (
                        <button
                          key={suggestion.imageUrl}
                          className={[
                            "overflow-hidden rounded-[1rem] border bg-white transition",
                            isSelected ? "border-[#c76038] ring-2 ring-[#ffd5c2]" : "border-[#ecd0c2] hover:border-[#d88d68]",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          type="button"
                          onClick={() => {
                            setSelectedSuggestionUrl(suggestion.imageUrl);
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt={suggestion.title} className="h-20 w-full object-cover" src={suggestion.imageUrl} />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
