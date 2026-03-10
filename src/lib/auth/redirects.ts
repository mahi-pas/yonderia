export const DEFAULT_AUTH_REDIRECT = "/dashboard";

export function sanitizeRedirectPath(
  redirectTo: string | null | undefined,
  origin?: string,
): string {
  if (!redirectTo) {
    return DEFAULT_AUTH_REDIRECT;
  }

  try {
    const normalizedValue = decodeURIComponent(redirectTo);

    if (normalizedValue.startsWith("/") && !normalizedValue.startsWith("//")) {
      return normalizedValue;
    }

    if (!origin) {
      return DEFAULT_AUTH_REDIRECT;
    }

    const redirectUrl = new URL(normalizedValue);

    if (redirectUrl.origin !== origin) {
      return DEFAULT_AUTH_REDIRECT;
    }

    return redirectUrl.pathname + redirectUrl.search + redirectUrl.hash;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
}
