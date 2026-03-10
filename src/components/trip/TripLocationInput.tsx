"use client";

import { useEffect, useRef, useState } from "react";
import Input from "@/components/ui/Input";
import { loadGoogleMapsApi, type GooglePlaceResult } from "@/lib/google-maps";

type LocationValue = {
  latitude: number | null;
  longitude: number | null;
  name: string;
};

type GoogleMapsAutocompleteInstance = {
  addListener: (eventName: "place_changed", handler: () => void) => { remove: () => void };
  getPlace: () => GooglePlaceResult;
};

type TripLocationInputProps = {
  disabled?: boolean;
  label?: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

export default function TripLocationInput({
  disabled = false,
  label = "Location",
  onChange,
  value,
}: TripLocationInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState<"idle" | "ready" | "unavailable">("idle");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let listener: { remove: () => void } | null = null;

    const initializeAutocomplete = async () => {
      try {
        const googleApi = await loadGoogleMapsApi();

        if (!inputRef.current || !googleApi?.maps?.places) {
          setStatus("unavailable");
          return;
        }

        const autocomplete = new googleApi.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
        }) as GoogleMapsAutocompleteInstance;

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const nextName = place.formatted_address || place.name || inputRef.current?.value || "";
          const nextLatitude = place.geometry?.location?.lat() ?? null;
          const nextLongitude = place.geometry?.location?.lng() ?? null;

          onChangeRef.current({
            latitude: nextLatitude,
            longitude: nextLongitude,
            name: nextName,
          });
        });

        setStatus("ready");
      } catch {
        setStatus("unavailable");
      }
    };

    void initializeAutocomplete();

    return () => {
      listener?.remove();
    };
  }, []);

  return (
    <Input
      ref={inputRef}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      disabled={disabled}
      enterKeyHint="search"
      hint={
        status === "ready"
          ? "Start typing and pick a Google Places suggestion."
          : "You can type any location manually if autocomplete is unavailable."
      }
      label={label}
      placeholder="Where are you headed?"
      spellCheck={false}
      value={value.name}
      onChange={(event) => {
        onChange({
          latitude: null,
          longitude: null,
          name: event.target.value,
        });
      }}
    />
  );
}
