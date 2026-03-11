"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type TouchEvent } from "react";

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
  const descriptionId = useId();
  const titleId = useId();
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [sheetOffset, setSheetOffset] = useState(0);

  useEffect(() => {
    const syncViewport = () => {
      setIsMobile(window.innerWidth < 640);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const animationFrame = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleEscape);
      setIsVisible(false);
      setSheetOffset(0);
    };
  }, [isOpen, onClose]);

  const resetSheetPosition = () => {
    touchStartYRef.current = null;
    isDraggingRef.current = false;
    setSheetOffset(0);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 640 || (scrollAreaRef.current?.scrollTop ?? 0) > 0) {
      return;
    }

    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || touchStartYRef.current === null) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
    const nextOffset = Math.max(0, currentY - touchStartYRef.current);

    if (nextOffset > 0) {
      event.preventDefault();
      setSheetOffset(Math.min(nextOffset, 220));
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) {
      return;
    }

    if (sheetOffset > 110) {
      onClose();
      return;
    }

    resetSheetPosition();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={[
        "fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-sm transition-opacity duration-200",
        isVisible ? "opacity-100" : "opacity-0",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        aria-label="Close modal"
        className="absolute inset-0 h-full w-full"
        tabIndex={-1}
        type="button"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 bottom-0 top-auto flex max-h-[100dvh] items-end sm:inset-0 sm:items-center sm:justify-center sm:p-6">
        <section
          aria-modal="true"
          aria-describedby={description ? descriptionId : undefined}
          aria-labelledby={title ? titleId : undefined}
          className={[
            "relative flex h-[100dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/70 bg-[rgba(255,249,245,0.98)] shadow-[0_-8px_40px_rgba(67,27,12,0.18)] transition-transform duration-300 ease-out sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-[2rem] sm:shadow-[0_28px_90px_rgba(90,40,20,0.24)]",
            isVisible ? "sm:scale-100" : "sm:scale-[0.98]",
            panelClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          role="dialog"
          style={{
            transform: isMobile ? `translateY(${sheetOffset + (isVisible ? 0 : 32)}px)` : undefined,
            transitionDuration: sheetOffset > 0 ? "0ms" : undefined,
          }}
        >
          <div
            className="touch-pan-y border-b border-[#f2d3c6] px-5 pb-4 pt-5 sm:px-8 sm:pt-7"
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
          >
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#e9c6b6] sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                {title ? (
                  <h2 className="font-display text-3xl leading-none text-[#34180f] sm:text-4xl" id={titleId}>
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p className="max-w-2xl text-sm leading-6 text-[#6f4a3b]" id={descriptionId}>
                    {description}
                  </p>
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

          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
            {children}
          </div>

          {footer ? (
            <div className="border-t border-[#f2d3c6] bg-[rgba(255,249,245,0.98)] px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-8 sm:pb-4">
              {footer}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
