"use client";

import LoginButton from "@/components/auth/LoginButton";
import AppleLoginButton from "@/components/auth/AppleLoginButton";

type AuthButtonsProps = {
  buttonClassName?: string;
  buttonLabel?: string;
  containerClassName?: string;
  redirectTo?: string;
};

/**
 * Renders Google sign-in and (on iOS) Apple sign-in buttons together.
 * Use this wherever a login prompt is needed.
 */
export default function AuthButtons({
  buttonClassName,
  buttonLabel,
  containerClassName,
  redirectTo,
}: AuthButtonsProps) {
  return (
    <div className="flex flex-col gap-3">
      <LoginButton
        buttonClassName={buttonClassName}
        buttonLabel={buttonLabel}
        containerClassName={containerClassName}
        redirectTo={redirectTo}
      />
      <AppleLoginButton
        buttonClassName={buttonClassName}
        containerClassName={containerClassName}
        redirectTo={redirectTo}
      />
    </div>
  );
}
