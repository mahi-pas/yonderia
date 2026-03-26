"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shows a banner when the device is offline.
 * Uses @capacitor/network on native, falls back to navigator.onLine on web.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init() {
      // Try Capacitor Network plugin first (works on native + web)
      try {
        const { Network } = await import("@capacitor/network");
        const status = await Network.getStatus();
        setIsOffline(!status.connected);

        const handle = await Network.addListener("networkStatusChange", (s) => {
          setIsOffline(!s.connected);
        });

        cleanup = () => {
          void handle.remove();
        };
      } catch {
        // Fallback: use browser events
        setIsOffline(!navigator.onLine);

        const goOffline = () => setIsOffline(true);
        const goOnline = () => setIsOffline(false);

        window.addEventListener("offline", goOffline);
        window.addEventListener("online", goOnline);

        cleanup = () => {
          window.removeEventListener("offline", goOffline);
          window.removeEventListener("online", goOnline);
        };
      }
    }

    void init();
    return () => cleanup?.();
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 bg-[#121212] px-4 py-2.5 text-sm font-bold text-white shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You&rsquo;re offline. Some features may not work.</span>
    </div>
  );
}
