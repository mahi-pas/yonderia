/** localStorage key for last trip page the signed-in user viewed (UUID). */
export const LAST_VIEWED_TRIP_STORAGE_KEY = "yonderia-last-viewed-trip-id";

export const LAST_TRIP_UPDATED_EVENT = "yonderia-last-trip-updated";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `/trip/{uuid}` or `/trip/{uuid}/subpath` — no query/hash. */
const TRIP_RETURN_PATH_RE = /^\/trip\/[0-9a-f-]{36}(\/[^?#]*)?$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/**
 * Validates `from` query used on profile links so we only return to in-app trip URLs.
 */
export function sanitizeProfileReturnPath(from: string | string[] | undefined): string | null {
  const raw = Array.isArray(from) ? from[0] : from;
  if (!raw || typeof raw !== "string") {
    return null;
  }

  try {
    const decoded = decodeURIComponent(raw.trim());
    const pathOnly = decoded.split("?")[0].split("#")[0];
    if (!TRIP_RETURN_PATH_RE.test(pathOnly)) {
      return null;
    }
    const match = pathOnly.match(/^\/trip\/([0-9a-f-]{36})/i);
    if (!match || !isUuid(match[1])) {
      return null;
    }
    return pathOnly;
  } catch {
    return null;
  }
}

export function buildProfileHref(userId: string, tripContextPath: string | null): string {
  const base = `/profile/${userId}`;
  if (!tripContextPath) {
    return base;
  }
  return `${base}?from=${encodeURIComponent(tripContextPath)}`;
}
