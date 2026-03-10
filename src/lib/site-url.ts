import { headers } from "next/headers";

/**
 * Returns the public site URL for the current request context.
 * Uses NEXT_PUBLIC_APP_URL or VERCEL_URL when set (production), otherwise
 * derives from request headers (x-forwarded-host, x-forwarded-proto) for correct
 * behavior behind proxies.
 */
export async function getSiteUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "development" ? "http" : "https");

  if (host) {
    return `${protocol}://${host}`;
  }

  throw new Error(
    "Unable to determine site URL. Set NEXT_PUBLIC_APP_URL or ensure request has Host/x-forwarded-host.",
  );
}
