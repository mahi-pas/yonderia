"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "yellow" | "outline" | "ghost";
type ButtonSize = "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  isLoading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const BASE_CLASSES =
  "inline-flex min-h-11 items-center justify-center font-bold uppercase tracking-wider transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-60 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "px-5 py-3 text-sm",
  lg: "px-6 py-3.5 text-base",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white border-2 border-[#121212] shadow-[4px_4px_0px_0px_black] hover:opacity-90 focus:ring-[var(--accent)]/40",
  secondary:
    "bg-[#1040C0] text-white border-2 border-[#121212] shadow-[4px_4px_0px_0px_black] hover:bg-[#1040C0]/90 focus:ring-[#1040C0]",
  yellow:
    "bg-[#F0C020] text-[#121212] border-2 border-[#121212] shadow-[4px_4px_0px_0px_black] hover:bg-[#F0C020]/90 focus:ring-[#F0C020]",
  outline:
    "bg-white text-[#121212] border-2 border-[#121212] shadow-[4px_4px_0px_0px_black] hover:bg-[#F0F0F0] focus:ring-[#121212]",
  ghost:
    "border-none text-[#121212] hover:bg-[#E0E0E0] focus:ring-[#121212]",
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
