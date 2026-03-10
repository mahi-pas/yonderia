const GOOGLE_MAPS_LIBRARIES = ["places"] as const;

export type GoogleMapsLibrary = (typeof GOOGLE_MAPS_LIBRARIES)[number];

export type GooglePlaceResult = {
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
  name?: string;
};

export type GoogleMapsAutocompleteInstance = {
  addListener: (eventName: "place_changed", handler: () => void) => { remove: () => void };
  getPlace: () => GooglePlaceResult;
};

export type GoogleMapsWindow = {
  maps: {
    event?: {
      addListenerOnce?: (instance: unknown, eventName: string, handler: () => void) => void;
      trigger?: (instance: unknown, eventName: string) => void;
    };
    InfoWindow: new () => {
      addListener: (eventName: "closeclick", handler: () => void) => { remove: () => void };
      close: () => void;
      open: (options: { anchor?: unknown; map?: unknown; shouldFocus?: boolean }) => void;
      setContent: (content: Element | string) => void;
    };
    LatLngBounds: new () => {
      extend: (position: { lat: number; lng: number }) => void;
    };
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => {
      fitBounds: (bounds: unknown, padding?: number) => void;
      getCenter?: () => unknown;
      getZoom?: () => number | undefined;
      setCenter?: (center: unknown) => void;
      setZoom?: (zoom: number) => void;
    };
    Marker: new (options: Record<string, unknown>) => {
      addListener: (eventName: "click", handler: () => void) => { remove: () => void };
      setMap: (map: unknown) => void;
    };
    Point: new (x: number, y: number) => unknown;
    Polyline: new (options: Record<string, unknown>) => {
      setMap: (map: unknown) => void;
    };
    Size: new (width: number, height: number) => unknown;
    places?: {
      Autocomplete: new (
        input: HTMLInputElement,
        options: { fields: string[]; types?: string[] },
      ) => GoogleMapsAutocompleteInstance;
    };
  };
};

declare global {
  interface Window {
    __yonderiaGoogleMapsPromise?: Promise<GoogleMapsWindow>;
    google?: GoogleMapsWindow;
  }
}

export function getGoogleMapsApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

export function getGoogleMapsLibraries(): GoogleMapsLibrary[] {
  return [...GOOGLE_MAPS_LIBRARIES];
}

export async function loadGoogleMapsApi(
  libraries: GoogleMapsLibrary[] = getGoogleMapsLibraries(),
): Promise<GoogleMapsWindow | null> {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey || typeof window === "undefined") {
    return null;
  }

  if (window.google?.maps) {
    return window.google;
  }

  if (!window.__yonderiaGoogleMapsPromise) {
    window.__yonderiaGoogleMapsPromise = new Promise<GoogleMapsWindow>((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=${encodeURIComponent(libraries.join(","))}&loading=async`;
      script.onload = () => {
        if (window.google?.maps) {
          resolve(window.google);
          return;
        }

        reject(new Error("Google Maps failed to initialize."));
      };
      script.onerror = () => {
        reject(new Error("Google Maps failed to load."));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      window.__yonderiaGoogleMapsPromise = undefined;
      throw error;
    });
  }

  return window.__yonderiaGoogleMapsPromise;
}
