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
  photographerName: string;
  photographerUrl: string;
  sourceUrl: string;
  title: string;
};

type AddEventModalProps = {
  currentUserId: string;
  dayDate: string;
  editItem?: ItineraryListItem | null;
  existingItems: ItineraryListItem[];
  isOpen: boolean;
  onClose: () => void;
  onCreated: (item: ItineraryListItem) => void;
  onDeleted?: (itemId: string) => void;
  onUpdated?: (item: ItineraryListItem) => void;
  tripId: string;
};

type FormState = {
  commuteArrivalDateTime: string;
  commuteDepartureDateTime: string;
  commuteDestination: LocationState;
  commuteOrigin: LocationState;
  dayDate: string;
  description: string;
  eventEndDateTime: string;
  eventLocation: LocationState;
  eventStartDateTime: string;
  hotelCheckInDateTime: string;
  hotelCheckOutDateTime: string;
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
  const datePart = dayDate || new Date().toISOString().slice(0, 10);
  return {
    commuteArrivalDateTime: `${datePart}T10:00`,
    commuteDepartureDateTime: `${datePart}T09:00`,
    commuteDestination: createEmptyLocation(),
    commuteOrigin: createEmptyLocation(),
    dayDate,
    description: "",
    eventEndDateTime: `${datePart}T10:00`,
    eventLocation: createEmptyLocation(),
    eventStartDateTime: `${datePart}T09:00`,
    hotelCheckInDateTime: `${datePart}T15:00`,
    hotelCheckOutDateTime: `${datePart}T11:00`,
    hotelLocation: createEmptyLocation(),
    title: "",
  };
}

function sanitizeSingleLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toIsoDateTime(value: string): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function toDateTimeInputValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function getDatePart(value: string): string | null {
  if (!value) {
    return null;
  }

  const [datePart] = value.split("T");
  return datePart || null;
}

function isEndTimeAfterStart(startTime: string | null, endTime: string | null): boolean {
  if (!startTime || !endTime) {
    return true;
  }

  return new Date(endTime).getTime() > new Date(startTime).getTime();
}

function getNextSortOrder(items: ItineraryListItem[], dayDate: string): number {
  const dayItems = items.filter((item) => item.day_date === dayDate);

  if (dayItems.length === 0) {
    return 0;
  }

  return Math.max(...dayItems.map((item) => item.sort_order)) + 1;
}

function getItemTypeLabel(itemType: ItineraryItemType): string {
  return ITEM_TYPES.find((type) => type.id === itemType)?.label ?? "Item";
}

function createFormStateFromItem(item: ItineraryListItem): FormState {
  return {
    commuteArrivalDateTime: item.item_type === "commute" ? toDateTimeInputValue(item.end_time) : "",
    commuteDepartureDateTime: item.item_type === "commute" ? toDateTimeInputValue(item.start_time) : "",
    commuteDestination:
      item.item_type === "commute"
        ? {
            latitude: item.destination_latitude,
            longitude: item.destination_longitude,
            name: item.destination_name ?? "",
          }
        : createEmptyLocation(),
    commuteOrigin:
      item.item_type === "commute"
        ? {
            latitude: item.latitude,
            longitude: item.longitude,
            name: item.location_name ?? "",
          }
        : createEmptyLocation(),
    dayDate: item.day_date,
    description: item.description ?? "",
    eventEndDateTime: item.item_type === "event" ? toDateTimeInputValue(item.end_time) : "",
    eventLocation:
      item.item_type === "event"
        ? {
            latitude: item.latitude,
            longitude: item.longitude,
            name: item.location_name ?? "",
          }
        : createEmptyLocation(),
    eventStartDateTime: item.item_type === "event" ? toDateTimeInputValue(item.start_time) : "",
    hotelCheckInDateTime: item.item_type === "hotel" ? toDateTimeInputValue(item.start_time) : "",
    hotelCheckOutDateTime: item.item_type === "hotel" ? toDateTimeInputValue(item.end_time) : "",
    hotelLocation:
      item.item_type === "hotel"
        ? {
            latitude: item.latitude,
            longitude: item.longitude,
            name: item.location_name ?? "",
          }
        : createEmptyLocation(),
    title: item.title,
  };
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
  editItem = null,
  existingItems,
  isOpen,
  onClose,
  onCreated,
  onDeleted,
  onUpdated,
  tripId,
}: AddEventModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const customImageRef = useRef<ImageState | null>(null);
  const [customImage, setCustomImage] = useState<ImageState | null>(null);
  const [draftItemId, setDraftItemId] = useState<string>(() => crypto.randomUUID());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(() => createInitialFormState(dayDate));
  const [imageSuggestions, setImageSuggestions] = useState<ImageSuggestion[]>([]);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [itemType, setItemType] = useState<ItineraryItemType>("event");
  const [selectedSuggestionUrl, setSelectedSuggestionUrl] = useState<string | null>(null);
  const [showCustomUploader, setShowCustomUploader] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isEditMode = editItem !== null;
  const itemTypeLabel = getItemTypeLabel(itemType);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    customImageRef.current = null;
    setCustomImage(null);
    setDraftItemId(editItem?.id ?? crypto.randomUUID());
    setErrorMessage(null);
    setExistingImageUrl(editItem?.image_url ?? null);
    setFormState(editItem ? createFormStateFromItem(editItem) : createInitialFormState(dayDate));
    setImageSuggestions([]);
    setIsImageUploading(false);
    setIsSaving(false);
    setIsSearchingImages(false);
    setItemType(editItem?.item_type ?? "event");
    setSelectedSuggestionUrl(null);
    setShowCustomUploader(false);
    setIsDeleteConfirmOpen(false);
    setDeleteError(null);
    setIsDeleting(false);
  }, [dayDate, editItem, isOpen]);

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
            : isEditMode
              ? null
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
  }, [formState, isEditMode, isOpen, itemType, showCustomUploader]);

  const selectedSuggestion = selectedSuggestionUrl
    ? imageSuggestions.find((result) => result.imageUrl === selectedSuggestionUrl) ?? null
    : isEditMode
      ? null
      : (imageSuggestions[0] ?? null);
  const previewImageUrl = customImage?.publicUrl ?? selectedSuggestion?.imageUrl ?? existingImageUrl ?? null;
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
      if (!formState.eventStartDateTime) {
        setErrorMessage("Add a start date and time for this event.");
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
      if (!formState.commuteDepartureDateTime) {
        setErrorMessage("Add a departure date and time for this commute.");
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
    const eventStartTime = toIsoDateTime(formState.eventStartDateTime);
    const eventEndTime = toIsoDateTime(formState.eventEndDateTime);
    const hotelCheckInTime = toIsoDateTime(formState.hotelCheckInDateTime);
    const hotelCheckOutTime = toIsoDateTime(formState.hotelCheckOutDateTime);
    const commuteArrivalTime = toIsoDateTime(formState.commuteArrivalDateTime);
    const commuteDepartureTime = toIsoDateTime(formState.commuteDepartureDateTime);
    const itemDayDate =
      itemType === "event"
        ? getDatePart(formState.eventStartDateTime)
        : itemType === "hotel"
          ? getDatePart(formState.hotelCheckInDateTime)
          : getDatePart(formState.commuteDepartureDateTime);

    if (itemType === "event" && !isEndTimeAfterStart(eventStartTime, eventEndTime)) {
      setErrorMessage("Choose an end time that's after the start time.");
      setIsSaving(false);
      return;
    }

    if (itemType === "commute" && !isEndTimeAfterStart(commuteDepartureTime, commuteArrivalTime)) {
      setErrorMessage("Choose an arrival time that's after the departure time.");
      setIsSaving(false);
      return;
    }

    if (itemType === "hotel" && !isEndTimeAfterStart(hotelCheckInTime, hotelCheckOutTime)) {
      setErrorMessage("Choose a check-out time that's after check-in.");
      setIsSaving(false);
      return;
    }

    const nextItem = {
      day_date: itemDayDate ?? formState.dayDate,
      description: description || null,
      destination_latitude: itemType === "commute" ? formState.commuteDestination.latitude : null,
      destination_longitude: itemType === "commute" ? formState.commuteDestination.longitude : null,
      destination_name:
        itemType === "commute" ? sanitizeSingleLine(formState.commuteDestination.name) || null : null,
      end_time:
        itemType === "event"
          ? eventEndTime
          : itemType === "hotel"
            ? hotelCheckOutTime
            : commuteArrivalTime,
      image_url: customImage?.publicUrl ?? selectedSuggestion?.imageUrl ?? existingImageUrl ?? null,
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
      start_time:
        itemType === "event" ? eventStartTime : itemType === "hotel" ? hotelCheckInTime : commuteDepartureTime,
      title,
    };

    try {
      if (isEditMode && editItem) {
        // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
        const { error } = await supabase.from("itinerary_items").update(nextItem).eq("id", editItem.id).eq("trip_id", tripId);

        if (error) {
          throw error;
        }

        onUpdated?.({
          ...editItem,
          ...nextItem,
        });
      } else {
        const createdItem = {
          ...nextItem,
          created_by: currentUserId,
          id: draftItemId,
          sort_order: getNextSortOrder(existingItems, itemDayDate ?? formState.dayDate),
          trip_id: tripId,
        };

        // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
        const { error } = await supabase.from("itinerary_items").insert(createdItem);

        if (error) {
          throw error;
        }

        onCreated(createdItem);
      }

      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't save that itinerary item right now.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  async function handleDeleteItem() {
    if (!editItem || !onDeleted) {
      return;
    }
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("itinerary_items")
        .delete()
        .eq("id", editItem.id)
        .eq("trip_id", tripId);
      if (error) throw error;
      onDeleted(editItem.id);
      setIsDeleteConfirmOpen(false);
      onClose();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "We couldn't delete that itinerary item right now.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Modal
      description={`${isEditMode ? "Editing" : "Adding to"} ${formatDayLabel(formState.dayDate)}.`}
      isOpen={isOpen}
      onClose={() => {
        if (!isSaving) {
          onClose();
        }
      }}
      panelClassName="sm:max-w-4xl"
      title={`${isEditMode ? "Edit" : "Add"} ${itemTypeLabel}`}
      footer={
        <div className="space-y-3">
          {errorMessage ? (
            <div className="border-2 border-[#D02020] bg-[#D02020]/10 px-4 py-3 text-sm text-[#D02020]">
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
              {isSaving ? "Saving..." : isEditMode ? "Save Changes" : `Save ${itemTypeLabel}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 pb-10">
        {!isEditMode ? (
          <div className="inline-flex border-2 border-[#121212] bg-white p-1">
            {ITEM_TYPES.map((type) => (
              <button
                key={type.id}
                className={[
                  "min-h-11 px-4 text-sm font-bold uppercase tracking-widest transition",
                  itemType === type.id
                    ? "bg-[#D02020] text-white"
                    : "border-2 border-[#121212] bg-white text-[#888888] hover:bg-[#F8F8F8] focus:outline-none focus:ring-2 focus:ring-[#D02020]/30",
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
        ) : null}

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
              <span className="block text-sm font-bold text-[#121212]">Description</span>
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
                    label="Start"
                    type="datetime-local"
                    value={formState.eventStartDateTime}
                    onChange={(event) => {
                      setErrorMessage(null);
                      setFormState((current) => ({
                        ...current,
                        eventStartDateTime: event.target.value,
                      }));
                    }}
                  />
                  <Input
                    disabled={isSaving}
                    label="End"
                    type="datetime-local"
                    value={formState.eventEndDateTime}
                    onChange={(event) => {
                      setErrorMessage(null);
                      setFormState((current) => ({
                        ...current,
                        eventEndDateTime: event.target.value,
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
                    label="Check-in"
                    type="datetime-local"
                    value={formState.hotelCheckInDateTime}
                    onChange={(event) => {
                      setErrorMessage(null);
                      setFormState((current) => ({
                        ...current,
                        hotelCheckInDateTime: event.target.value,
                      }));
                    }}
                  />
                  <Input
                    disabled={isSaving}
                    hint="Optional"
                    label="Check-out"
                    type="datetime-local"
                    value={formState.hotelCheckOutDateTime}
                    onChange={(event) => {
                      setErrorMessage(null);
                      setFormState((current) => ({
                        ...current,
                        hotelCheckOutDateTime: event.target.value,
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
                  label="Departure"
                  type="datetime-local"
                  value={formState.commuteDepartureDateTime}
                  onChange={(event) => {
                    setErrorMessage(null);
                    setFormState((current) => ({
                      ...current,
                      commuteDepartureDateTime: event.target.value,
                    }));
                  }}
                />
                <Input
                  disabled={isSaving}
                  label="Arrival"
                  type="datetime-local"
                  value={formState.commuteArrivalDateTime}
                  onChange={(event) => {
                    setErrorMessage(null);
                    setFormState((current) => ({
                      ...current,
                      commuteArrivalDateTime: event.target.value,
                    }));
                  }}
                />

                <TripLocationInput
                  disabled={isSaving}
                  label="Origin"
                  placeholder="Where are you leaving from?"
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

          <div className="space-y-4 border-2 border-[#121212] bg-white p-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#121212]">Image</p>
              <p className="text-sm leading-6 text-[#888888]">
                Auto-suggested from your title{locationLabel ? ` and ${locationLabel}` : ""}.
              </p>
            </div>

            {previewImageUrl ? (
              <div className="overflow-hidden border-2 border-[#121212] bg-[#F8F8F8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={formState.title || "Suggested itinerary image"} className="h-48 w-full object-cover" src={previewImageUrl} />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center border-2 border-dashed border-[#121212] bg-white px-4 text-center text-sm leading-6 text-[#888888]">
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
                    setExistingImageUrl(null);
                    setShowCustomUploader(true);
                  }}
                >
                  Change image
                </Button>

                {isSearchingImages ? (
                  <p className="text-sm text-[#888888]">Finding image suggestions...</p>
                ) : null}

                {imageSuggestions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {imageSuggestions.map((suggestion) => {
                        const isSelected = suggestion.imageUrl === selectedSuggestion?.imageUrl;

                        return (
                          <button
                            key={suggestion.imageUrl}
                            className={[
                              "overflow-hidden border-2 bg-white transition",
                              isSelected ? "border-[#D02020] ring-2 ring-[#D02020]/30" : "border-[#121212] hover:border-[#888888]",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            type="button"
                            onClick={() => {
                              setExistingImageUrl(null);
                              setSelectedSuggestionUrl(suggestion.imageUrl);
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt={suggestion.title} className="h-20 w-full object-cover" src={suggestion.imageUrl} />
                          </button>
                        );
                      })}
                    </div>

                    {selectedSuggestion ? (
                      <p className="text-xs text-[#666666]">
                        Photo by{" "}
                        <a
                          className="underline hover:text-[#D02020]"
                          href={selectedSuggestion.photographerUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {selectedSuggestion.photographerName}
                        </a>{" "}
                        on{" "}
                        <a
                          className="underline hover:text-[#D02020]"
                          href="https://unsplash.com?utm_source=yonderia&utm_medium=referral"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Unsplash
                        </a>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {isEditMode && editItem ? (
          <div className="mt-8 border-t-2 border-[#121212] pt-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#888888]">
              Danger zone
            </p>
            <button
              type="button"
              className="text-sm text-[#D02020] underline decoration-[#D02020]/40 underline-offset-2 hover:decoration-[#D02020]"
              onClick={() => setIsDeleteConfirmOpen(true)}
              disabled={isSaving}
            >
              Delete this item
            </button>
          </div>
        ) : null}
      </div>

      <Modal
        description="This action cannot be undone."
        isOpen={isDeleteConfirmOpen}
        title="Are you sure?"
        onClose={() => {
          if (!isDeleting) {
            setDeleteError(null);
            setIsDeleteConfirmOpen(false);
          }
        }}
        footer={
          <div className="space-y-3">
            {deleteError ? (
              <div className="border-2 border-[#D02020] bg-[#D02020]/10 px-4 py-3 text-sm text-[#D02020]">
                {deleteError}
              </div>
            ) : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                disabled={isDeleting}
                variant="secondary"
                onClick={() => {
                  setDeleteError(null);
                  setIsDeleteConfirmOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                className="border-2 border-[#D02020] bg-[#D02020] text-white hover:bg-[#D02020]/90 focus:ring-[#D02020]/30"
                isLoading={isDeleting}
                onClick={() => void handleDeleteItem()}
              >
                Delete
              </Button>
            </div>
          </div>
        }
      >
        <p className="text-sm leading-6 text-[#121212]/80">
          {editItem
            ? `Delete "${editItem.title}"? This action cannot be undone.`
            : "Delete this item? This action cannot be undone."}
        </p>
      </Modal>
    </Modal>
  );
}
