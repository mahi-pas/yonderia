"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  panelClassName?: string;
  /** When set (e.g. trip theme style), panel uses var(--surface) and theme-aware text colors */
  panelStyle?: React.CSSProperties & Record<string, string>;
};

export default function Modal({
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
        "fixed inset-0 z-50 bg-black/70 backdrop-blur-md transition-opacity duration-200",
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
            "relative flex w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--border-strong)] shadow-[0_-4px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-transform duration-300 ease-out sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-2xl sm:shadow-[0_8px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(139,92,246,0.08)]",
            panelStyle ? "bg-[var(--surface)]" : "bg-[rgba(20,20,31,0.98)]",
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
          <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--accent-gradient)] opacity-40" />

          <div
            className="touch-pan-y border-b border-[var(--border)] pl-5 pr-[max(1.5rem,calc(0.5rem+env(safe-area-inset-right)))] pb-4 pt-5 sm:px-8 sm:pt-7"
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
          >
            <div className={`mx-auto mb-4 h-1.5 w-14 rounded-full sm:hidden ${panelStyle ? "bg-[var(--surface-muted,var(--muted))]" : "bg-[#3f3f46]"}`} />
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                {title ? (
                  <h2 className={`font-display text-3xl leading-none sm:text-4xl ${panelStyle ? "text-[var(--foreground)]" : "text-[#fafafa]"}`} id={titleId}>
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p className={`max-w-2xl text-sm leading-6 ${panelStyle ? "text-[var(--muted-foreground)]" : "text-[var(--muted)]"}`} id={descriptionId}>
                    {description}
                  </p>
                ) : null}
              </div>

              <button
                aria-label="Close modal"
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-xl transition hover:bg-[var(--surface-elevated)] ${panelStyle ? "text-[var(--muted-foreground)] hover:text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[#fafafa]"}`}
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
            <div className={`border-t border-[var(--border)] px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-8 sm:pb-4 ${panelStyle ? "bg-[var(--surface)]" : "bg-[rgba(20,20,31,0.98)]"}`}>
              {footer}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
}
