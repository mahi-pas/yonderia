"use client";

import { Capacitor } from "@capacitor/core";

/** True when running inside a native Capacitor shell (iOS or Android). */
export function isNative(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/** True when running inside Capacitor on iOS. */
export function isIOS(): boolean {
  return typeof window !== "undefined" && Capacitor.getPlatform() === "ios";
}

/** True when running inside Capacitor on Android. */
export function isAndroid(): boolean {
  return typeof window !== "undefined" && Capacitor.getPlatform() === "android";
}

/** True when running in a regular browser (not inside a native shell). */
export function isWeb(): boolean {
  return typeof window === "undefined" || Capacitor.getPlatform() === "web";
}
