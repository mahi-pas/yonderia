"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_AUTH_REDIRECT, sanitizeRedirectPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/client";
import { isIOS } from "@/lib/platform";

/**
 * Sign in with Apple button — only rendered on iOS native builds.
 * Apple requires this when other social logins (Google) are offered.
 *
 * Uses Supabase's built-in Apple OAuth provider. On native iOS,
 * Supabase uses the native ASAuthorizationController via the
 * @capacitor-community/apple-sign-in plugin for a seamless flow.
 */

type AppleLoginButtonProps = {
  buttonClassName?: string;
  containerClassName?: string;
  redirectTo?: string;
};

export default function AppleLoginButton({
  buttonClassName = "",
  containerClassName = "",
  redirectTo,
}: AppleLoginButtonProps) {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Only show on iOS
  if (!isIOS()) {
    return null;
  }

  const handleAppleLogin = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const searchRedirect = sanitizeRedirectPath(redirectTo ?? searchParams.get("redirectTo"));
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("redirectTo", searchRedirect === DEFAULT_AUTH_REDIRECT ? DEFAULT_AUTH_REDIRECT : searchRedirect);

      // Use the native Apple Sign In flow via Capacitor plugin
      const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
      const result = await SignInWithApple.authorize({
        clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? "com.yonderia.app",
        redirectURI: callbackUrl.toString(),
        scopes: "email name",
      });

      if (result.response.identityToken) {
        // Exchange the Apple ID token with Supabase
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: result.response.identityToken,
          nonce: undefined,
        });

        if (error) {
          throw error;
        }

        window.location.href = searchRedirect;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We couldn't start Apple sign-in.";
      // Don't show error if user cancelled
      if (!message.includes("cancel") && !message.includes("Cancel")) {
        setErrorMessage(message);
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className={["w-full max-w-sm", containerClassName].filter(Boolean).join(" ")}>
      <button
        className={[
          "group inline-flex min-h-12 w-full items-center justify-center gap-3 border-2 sm:border-4 border-[#121212] bg-[#121212] px-5 py-4 text-base font-bold uppercase tracking-wider text-white shadow-[4px_4px_0px_0px_#666] sm:shadow-[6px_6px_0px_0px_#666] transition duration-200 hover:bg-[#121212]/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-[#121212]/40 disabled:cursor-not-allowed disabled:opacity-70",
          buttonClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={isSubmitting}
        type="button"
        onClick={() => {
          void handleAppleLogin();
        }}
      >
        <span className="text-xl leading-none">&#63743;</span>
        <span>{isSubmitting ? "Signing in..." : "Sign in with Apple"}</span>
      </button>

      {errorMessage ? (
        <p className="mt-3 text-center text-sm font-medium text-[#D02020]">{errorMessage}</p>
      ) : null}
    </div>
  );
}
