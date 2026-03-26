"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_AUTH_REDIRECT, sanitizeRedirectPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/client";

const REDIRECT_STORAGE_KEY = "yonderia-auth-redirect";

type LoginButtonProps = {
  buttonClassName?: string;
  buttonLabel?: string;
  containerClassName?: string;
  redirectTo?: string;
};

export default function LoginButton({
  buttonClassName = "",
  buttonLabel = "Sign in with Google",
  containerClassName = "",
  redirectTo,
}: LoginButtonProps) {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const searchRedirect = sanitizeRedirectPath(redirectTo ?? searchParams.get("redirectTo"));
      const storedRedirect =
        typeof window === "undefined"
          ? DEFAULT_AUTH_REDIRECT
          : sanitizeRedirectPath(
              window.localStorage.getItem(REDIRECT_STORAGE_KEY),
              window.location.origin,
            );
      const redirectTarget =
        searchRedirect === DEFAULT_AUTH_REDIRECT ? storedRedirect : searchRedirect;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(REDIRECT_STORAGE_KEY, redirectTarget);
      }

      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("redirectTo", redirectTarget);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw error;
      }

      if (data.url) {
        // On native platforms, open in InAppBrowser; on web, redirect normally
        const { openOAuthInNativeBrowser } = await import("@/lib/auth/native-oauth");
        const handled = await openOAuthInNativeBrowser(data.url);
        if (!handled) {
          window.location.href = data.url;
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We couldn't start Google sign-in.";
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className={["w-full max-w-sm", containerClassName].filter(Boolean).join(" ")}>
      <button
        className={[
          "group inline-flex min-h-12 w-full items-center justify-center gap-3 border-2 sm:border-4 border-[#121212] bg-[#D02020] px-5 py-4 text-base font-bold uppercase tracking-wider text-white shadow-[4px_4px_0px_0px_black] sm:shadow-[6px_6px_0px_0px_black] transition duration-200 hover:bg-[#D02020]/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-[#D02020]/40 disabled:cursor-not-allowed disabled:opacity-70",
          buttonClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={isSubmitting}
        type="button"
        onClick={() => {
          void handleLogin();
        }}
      >
        <span className="flex h-8 w-8 items-center justify-center border-2 border-white/40 bg-white text-base font-black text-[#D02020]">
          G
        </span>
        <span>{isSubmitting ? "Opening Google..." : buttonLabel}</span>
      </button>

      {errorMessage ? (
        <p className="mt-3 text-center text-sm font-medium text-[#D02020]">{errorMessage}</p>
      ) : null}
    </div>
  );
}
