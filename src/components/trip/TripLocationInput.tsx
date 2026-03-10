"use client";

import { useEffect, useRef, useState } from "react";
import Input from "@/components/ui/Input";

type LocationValue = {
  latitude: number | null;
  longitude: number | null;
  name: string;
};

type GooglePlaceResult = {
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
  name?: string;
};

type GoogleMapsAutocompleteInstance = {
  addListener: (eventName: "place_changed", handler: () => void) => { remove: () => void };
  getPlace: () => GooglePlaceResult;
};

type GoogleMapsApi = {
  maps: {
    places: {
      Autocomplete: new (
        input: HTMLInputElement,
        options: { fields: string[]; types?: string[] },
      ) => GoogleMapsAutocompleteInstance;
    };
  };
};

declare global {
  interface Window {
    __yonderiaPlacesPromise?: Promise<void>;
    google?: GoogleMapsApi;
  }
}

type TripLocationInputProps = {
  disabled?: boolean;
  label?: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

function loadPlacesLibrary(): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey || typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (window.__yonderiaPlacesPromise) {
    return window.__yonderiaPlacesPromise;
  }

  window.__yonderiaPlacesPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Places failed to load."));
    document.head.appendChild(script);
  });

  return window.__yonderiaPlacesPromise;
}

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
        await loadPlacesLibrary();

        if (!inputRef.current || !window.google?.maps?.places) {
          setStatus("unavailable");
          return;
        }

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
        });

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
      disabled={disabled}
      hint={
        status === "ready"
          ? "Start typing and pick a Google Places suggestion."
          : "You can type any location manually if autocomplete is unavailable."
      }
      label={label}
      placeholder="Where are you headed?"
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
