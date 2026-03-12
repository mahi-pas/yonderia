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

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        throw error;
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
          "btn-press group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-[image:var(--accent-gradient)] px-5 py-4 text-base font-semibold text-white shadow-[0_2px_24px_rgba(139,92,246,0.3)] transition hover:brightness-110 hover:shadow-[0_4px_32px_rgba(139,92,246,0.4)] focus:outline-none focus:ring-4 focus:ring-[#8b5cf6]/30 disabled:cursor-not-allowed disabled:opacity-70",
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
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-base text-white shadow-sm">
          G
        </span>
        <span>{isSubmitting ? "Opening Google..." : buttonLabel}</span>
      </button>

      {errorMessage ? (
        <p className="mt-3 text-center text-sm text-[#fca5a5]">{errorMessage}</p>
      ) : null}
    </div>
  );
}
