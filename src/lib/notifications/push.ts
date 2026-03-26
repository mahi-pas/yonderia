"use client";

import { isNative } from "@/lib/platform";

/**
 * Push notification service for Capacitor (iOS + Android).
 *
 * IMPORTANT: Do NOT request permission on app open — Apple requires
 * contextual permission requests. Call `requestPushPermission()` on
 * a relevant user action (e.g., enabling notifications in settings,
 * joining a trip, etc.).
 */

type PushNotificationHandler = (notification: {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}) => void;

let isRegistered = false;
let foregroundHandler: PushNotificationHandler | null = null;
let tapHandler: PushNotificationHandler | null = null;

/**
 * Set a handler for notifications received while the app is in the foreground.
 */
export function onForegroundNotification(handler: PushNotificationHandler): void {
  foregroundHandler = handler;
}

/**
 * Set a handler for when a user taps a notification.
 */
export function onNotificationTap(handler: PushNotificationHandler): void {
  tapHandler = handler;
}

/**
 * Request push notification permission and register with FCM/APNs.
 * Returns the device token on success, or null if denied/unavailable.
 *
 * Call this contextually — NOT on app launch.
 */
export async function requestPushPermission(): Promise<string | null> {
  if (!isNative()) {
    return null;
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let permResult = await PushNotifications.checkPermissions();

    if (permResult.receive === "prompt" || permResult.receive === "prompt-with-rationale") {
      permResult = await PushNotifications.requestPermissions();
    }

    if (permResult.receive !== "granted") {
      return null;
    }

    // Register with FCM/APNs
    await PushNotifications.register();

    // Wait for the registration token
    const token = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 10000);

      void PushNotifications.addListener("registration", (tokenResult) => {
        clearTimeout(timeout);
        resolve(tokenResult.value);
      });

      void PushNotifications.addListener("registrationError", () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });

    if (token && !isRegistered) {
      isRegistered = true;
      setupNotificationListeners();
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Register the device token with the backend so we can send pushes.
 */
export async function registerDeviceToken(token: string): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  const platform = Capacitor.getPlatform(); // "ios" | "android"

  await fetch("/api/notifications/register-device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_token: token, platform }),
  });
}

/**
 * Request permission, get token, and register with backend — all in one call.
 * Returns true if successfully registered.
 */
export async function enablePushNotifications(): Promise<boolean> {
  const token = await requestPushPermission();
  if (!token) {
    return false;
  }

  await registerDeviceToken(token);
  return true;
}

function setupNotificationListeners(): void {
  void import("@capacitor/push-notifications").then(({ PushNotifications }) => {
    // Foreground notifications
    void PushNotifications.addListener(
      "pushNotificationReceived",
      (notification) => {
        if (foregroundHandler) {
          foregroundHandler({
            title: notification.title ?? undefined,
            body: notification.body ?? undefined,
            data: notification.data as Record<string, string> | undefined,
          });
        }
      },
    );

    // Notification tapped (app was backgrounded or killed)
    void PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action) => {
        if (tapHandler) {
          tapHandler({
            title: action.notification.title ?? undefined,
            body: action.notification.body ?? undefined,
            data: action.notification.data as Record<string, string> | undefined,
          });
        }
      },
    );
  });
}
