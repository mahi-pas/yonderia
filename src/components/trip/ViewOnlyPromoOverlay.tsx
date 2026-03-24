"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Shown on view-only shared trip links to funnel visitors toward signing up / the app home.
 */
export default function ViewOnlyPromoOverlay() {
  const [open, setOpen] = useState(true);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const overlay = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        type="button"
        onClick={() => {
          setOpen(false);
        }}
      />

      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[rgba(20,20,31,0.97)] shadow-[0_8px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        role="dialog"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--accent-gradient)] opacity-40" />

        <div className="relative p-6 sm:p-8">
          <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
            <button
              aria-label="Close"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-lg text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[#fafafa]"
              type="button"
              onClick={() => {
                setOpen(false);
              }}
            >
              ×
            </button>
          </div>

          <p className="text-xs font-semibold tracking-wide uppercase gradient-text">Yonderia</p>
          <h2 className="mt-3 pr-10 font-display text-2xl leading-tight text-[#fafafa] sm:text-3xl" id={titleId}>
            Want to make a trip invite like this?
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#d4d4d8]">
            Start on the home page—sign in and create a trip, then share view-only or join links with your group.
          </p>

          <div className="mt-6">
            <Link
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[image:var(--accent-gradient)] px-6 py-3 text-sm font-semibold text-white shadow-[0_2px_24px_rgba(139,92,246,0.3)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30 sm:w-auto"
              href="/"
              onClick={() => {
                setOpen(false);
              }}
            >
              Make one here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : null;
}
