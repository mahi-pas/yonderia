import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for Yonderia.
 *
 * The app runs in **remote URL mode** — the WebView loads the production
 * Vercel deployment (or local dev server) over HTTPS so that full Next.js
 * SSR, cookies, and OAuth redirects work correctly.
 *
 * To use local live-reload during development:
 *   CAPACITOR_SERVER_URL=http://<your-lan-ip>:3000 npx cap sync
 */

const productionUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://yonderia.vercel.app";

const serverUrl = process.env.CAPACITOR_SERVER_URL ?? productionUrl;

const config: CapacitorConfig = {
  appId: "com.yonderia.app",
  appName: "Yonderia",
  webDir: "public",

  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },

  ios: {
    contentInset: "automatic",
    scheme: "yonderia",
  },

  android: {
    allowMixedContent: false,
  },
};

export default config;
