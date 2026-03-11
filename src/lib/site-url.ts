import { headers } from "next/headers";

/**
 * Returns the public site URL for the current request context.
 * In development, always derives from request headers (localhost).
 * In production, uses NEXT_PUBLIC_APP_URL or VERCEL_URL when set, otherwise
 * derives from request headers (x-forwarded-host, x-forwarded-proto).
 */
export async function getSiteUrl(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "development" ? "http" : "https");

  if (host) {
    return `${protocol}://${host}`;
  }

  if (process.env.NODE_ENV === "development") {
    throw new Error(
      "Unable to determine site URL in development. Ensure request has Host header.",
    );
  }

  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  throw new Error(
    "Unable to determine site URL. Set NEXT_PUBLIC_APP_URL or ensure request has Host/x-forwarded-host.",
  );
}
