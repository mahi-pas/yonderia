"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

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
        className="absolute inset-0 bg-[#121212]/60"
        type="button"
        onClick={() => {
          setOpen(false);
        }}
      />

      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-md overflow-hidden border-2 sm:border-4 border-[#121212] bg-white shadow-[8px_8px_0px_0px_black]"
        role="dialog"
      >
        {/* Yellow accent stripe */}
        <div className="h-2 bg-[#F0C020]" />

        <div className="relative p-6 sm:p-8">
          <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
            <button
              aria-label="Close"
              className="inline-flex h-10 w-10 items-center justify-center border-2 border-[#121212] bg-white text-lg font-bold text-[#121212] transition hover:bg-[#F0C020] active:translate-x-[2px] active:translate-y-[2px]"
              type="button"
              onClick={() => {
                setOpen(false);
              }}
            >
              ×
            </button>
          </div>

          <div className="mb-3 h-2 w-2 rounded-full bg-[#D02020]" />
          <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Yonderia</p>
          <h2 className="mt-3 pr-10 font-display text-2xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-3xl" id={titleId}>
            Want to make a trip invite like this?
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[#888888]">
            Start on the home page—sign in and create a trip, then share view-only or join links with your group.
          </p>

          <div className="mt-6">
            <Link
              className="inline-flex min-h-12 w-full items-center justify-center border-2 border-[#121212] bg-[#D02020] px-6 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-[4px_4px_0px_0px_black] transition duration-200 hover:bg-[#D02020]/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-[#D02020]/40 sm:w-auto"
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
