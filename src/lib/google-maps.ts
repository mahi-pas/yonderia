const GOOGLE_MAPS_LIBRARIES = ["places"] as const;

export function getGoogleMapsApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

export function getGoogleMapsLibraries() {
  return [...GOOGLE_MAPS_LIBRARIES];
}
