"use client";

import { App } from "@capacitor/app";
import { isNative } from "@/lib/platform";

/**
 * Initializes deep link handling for Capacitor native apps.
 *
 * When a universal link (iOS) or app link (Android) opens the app,
 * this extracts the path and navigates to it using the provided
 * router function.
 *
 * Call this once from a top-level client component (e.g., AuthProvider or AppShell).
 */
export function initDeepLinkListener(navigate: (path: string) => void): (() => void) | undefined {
  if (!isNative()) {
    return undefined;
  }

  let removed = false;

  void App.addListener("appUrlOpen", (event) => {
    if (removed) return;

    try {
      const url = new URL(event.url);
      const path = url.pathname + url.search + url.hash;
      if (path && path !== "/") {
        navigate(path);
      }
    } catch {
      // Invalid URL, ignore
    }
  });

  return () => {
    removed = true;
    void App.removeAllListeners();
  };
}
