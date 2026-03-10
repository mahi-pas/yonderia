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
  "inline-flex min-h-11 items-center justify-center rounded-full font-semibold transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "px-4 py-3 text-sm",
  lg: "px-5 py-3.5 text-base",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#c76038] text-white shadow-[0_18px_45px_rgba(199,96,56,0.28)] hover:bg-[#b55531] focus:ring-[#ffd4be]",
  secondary:
    "border border-[#ddb39f] bg-white/90 text-[#5a2b1c] shadow-sm hover:border-[#c67b5a] hover:bg-[#fff3ec] focus:ring-[#ffe0d1]",
  ghost: "bg-transparent text-[#6a3d2d] hover:bg-[#fff1ea] focus:ring-[#ffe0d1]",
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
