"use client";

import { useEffect, type ReactNode } from "react";

type ModalProps = {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  panelClassName?: string;
};

export default function Modal({
  children,
  description,
  footer,
  isOpen,
  onClose,
  panelClassName = "",
  title,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-sm">
      <button
        aria-label="Close modal"
        className="absolute inset-0 h-full w-full"
        type="button"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 bottom-0 top-auto flex max-h-[100dvh] items-end sm:inset-0 sm:items-center sm:justify-center sm:p-6">
        <section
          aria-modal="true"
          className={[
            "relative flex h-[100dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/70 bg-[rgba(255,249,245,0.98)] shadow-[0_-8px_40px_rgba(67,27,12,0.18)] sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-[2rem] sm:shadow-[0_28px_90px_rgba(90,40,20,0.24)]",
            panelClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          role="dialog"
        >
          <div className="border-b border-[#f2d3c6] px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#e9c6b6] sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                {title ? (
                  <h2 className="font-display text-3xl leading-none text-[#34180f] sm:text-4xl">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p className="max-w-2xl text-sm leading-6 text-[#6f4a3b]">{description}</p>
                ) : null}
              </div>

              <button
                aria-label="Close modal"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ebc5b5] bg-white text-xl text-[#6b4131] transition hover:bg-[#fff3eb]"
                type="button"
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">{children}</div>

          {footer ? (
            <div className="border-t border-[#f2d3c6] bg-[rgba(255,249,245,0.98)] px-5 py-4 sm:px-8">
              {footer}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
