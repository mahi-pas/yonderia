/**
 * Google-hosted profile photos (lh3.googleusercontent.com, etc.) often fail when the
 * browser sends a third-party Referer, or when Next.js Image Optimization fetches them
 * server-side. Use no-referrer on the final <img> and skip the optimizer for these URLs.
 */
export function isGoogleUserContentAvatarUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

export const avatarImageReferrerPolicy = "no-referrer" as const;
