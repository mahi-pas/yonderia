"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  /** Renders flush below the title header, full panel width (e.g. copy confirmation). Not inside the scroll area. */
  belowHeader?: ReactNode;
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  panelClassName?: string;
  panelStyle?: React.CSSProperties & Record<string, string>;
};

export default function Modal({
  belowHeader,
  children,
  description,
  footer,
  isOpen,
  onClose,
  panelClassName = "",
  panelStyle,
  title,
}: ModalProps) {
  const descriptionId = useId();
  const titleId = useId();
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [sheetOffset, setSheetOffset] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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
        onCloseRef.current();
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
  }, [isOpen]);

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

  const overlay = (
    <div
      className={[
        "fixed inset-0 z-50 bg-[#121212]/60 transition-opacity duration-200",
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

      <div className="absolute inset-0 flex items-end justify-center pt-[env(safe-area-inset-top)] sm:items-center sm:justify-center sm:pt-0 sm:p-6">
        <section
          aria-modal="true"
          aria-describedby={description ? descriptionId : undefined}
          aria-labelledby={title ? titleId : undefined}
          className={[
            "relative flex w-full flex-col overflow-hidden border-2 sm:border-4 border-[#121212] bg-white shadow-[8px_8px_0px_0px_black] transition-transform duration-200 ease-out sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl",
            "min-h-[calc(100svh-env(safe-area-inset-top))] h-[calc(100svh-env(safe-area-inset-top))] sm:min-h-0 sm:h-auto",
            isVisible ? "sm:scale-100 sm:opacity-100" : "sm:scale-[0.96] sm:opacity-0",
            panelClassName,
          ]
            .filter(Boolean)
            .join(" ")}
          role="dialog"
          style={{
            ...panelStyle,
            transform: isMobile ? `translateY(${sheetOffset + (isVisible ? 0 : 100)}%)` : undefined,
            transitionDuration: sheetOffset > 0 ? "0ms" : undefined,
          }}
        >
          <div
            className="touch-pan-y border-b-2 sm:border-b-4 border-[#121212] pl-5 pr-[max(1.5rem,calc(0.5rem+env(safe-area-inset-right)))] pb-4 pt-5 sm:px-8 sm:pt-7"
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
          >
            <div className="mx-auto mb-4 h-1.5 w-14 bg-[#121212] sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                {title ? (
                  <h2 className="font-display text-3xl font-black uppercase tracking-tighter leading-[0.9] text-[#121212] sm:text-4xl" id={titleId}>
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p className="max-w-2xl text-sm leading-6 font-medium text-[#888888]" id={descriptionId}>
                    {description}
                  </p>
                ) : null}
              </div>

              <button
                aria-label="Close modal"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#121212] bg-white text-xl font-bold text-[#121212] transition hover:bg-[#F0C020] active:translate-x-[2px] active:translate-y-[2px]"
                type="button"
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </div>

          {belowHeader ? <div className="shrink-0 w-full">{belowHeader}</div> : null}

          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
            {children}
          </div>

          {footer ? (
            <div className="border-t-2 sm:border-t-4 border-[#121212] bg-[#F8F8F8] px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-8 sm:pb-4">
              {footer}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
}
