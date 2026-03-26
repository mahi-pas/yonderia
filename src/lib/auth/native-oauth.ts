"use client";

import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { isNative } from "@/lib/platform";

/**
 * On native platforms, opens the OAuth URL in an InAppBrowser so the
 * redirect back to the app works correctly (WebView cookie isolation
 * would otherwise break the OAuth flow).
 *
 * The InAppBrowser shares cookies with the main WebView on both iOS
 * and Android when loaded over HTTPS, so after the OAuth callback
 * completes and redirects back to the app URL, the session cookie
 * is written to the WebView's cookie store.
 *
 * Returns true if handled natively, false if the caller should use
 * the default browser redirect.
 */
export async function openOAuthInNativeBrowser(oauthUrl: string): Promise<boolean> {
  if (!isNative()) {
    return false;
  }

  // Listen for the app URL open event (universal link / deep link redirect)
  const listenerHandle = await App.addListener("appUrlOpen", async () => {
    // The OAuth callback has redirected back to our app — close the browser
    try {
      await Browser.close();
    } catch {
      // Browser may already be closed
    }
    await listenerHandle.remove();
  });

  await Browser.open({
    url: oauthUrl,
    presentationStyle: "popover",
  });

  return true;
}
