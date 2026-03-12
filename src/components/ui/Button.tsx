"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  isLoading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const BASE_CLASSES =
  "btn-press inline-flex min-h-11 items-center justify-center rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "px-4 py-3 text-sm",
  lg: "px-5 py-3.5 text-base",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[image:var(--accent-gradient)] text-white shadow-[0_2px_20px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_28px_rgba(139,92,246,0.4)] hover:brightness-110 focus:ring-[#8b5cf6]/30",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--surface)] text-[#d4d4d8] shadow-sm hover:border-[#8b5cf6]/40 hover:bg-[var(--surface-elevated)] focus:ring-[#8b5cf6]/20",
  ghost: "bg-transparent text-[#d4d4d8] hover:bg-[var(--surface)] focus:ring-[#8b5cf6]/20",
};

export default function Button({
  children,
  className = "",
  disabled,
  isLoading = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={[BASE_CLASSES, SIZE_CLASSES[size], VARIANT_CLASSES[variant], className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? "Loading..." : children}
    </button>
  );
}
