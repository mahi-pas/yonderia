"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";

export type GifItem = {
  id: string;
  url: string;
  fullUrl: string;
  width: number;
  height: number;
};

type GifPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
};

const DEBOUNCE_MS = 300;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

export default function GifPicker({ isOpen, onClose, onSelect }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  const fetchGifs = useCallback(
    async (pos?: string, append = false) => {
      const url = debouncedQuery
        ? `/api/gifs/search?q=${encodeURIComponent(debouncedQuery)}${pos ? `&pos=${encodeURIComponent(pos)}` : ""}`
        : `/api/gifs/trending${pos ? `?pos=${encodeURIComponent(pos)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as { next?: string; results?: GifItem[] };
      const list = data.results ?? [];
      setNext(typeof data.next === "string" && data.next ? data.next : null);
      if (append) {
        setResults((prev) => [...prev, ...list]);
      } else {
        setResults(list);
      }
    },
    [debouncedQuery],
  );

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setLoading(true);
      setResults([]);
      setNext(null);
    });
    queueMicrotask(() => void fetchGifs().finally(() => setLoading(false)));
  }, [isOpen, debouncedQuery, fetchGifs]);

  const loadMore = useCallback(() => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    void fetchGifs(next, true).finally(() => setLoadingMore(false));
  }, [next, loadingMore, fetchGifs]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !next || loadingMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      loadMore();
    }
  }, [next, loadingMore, loadMore]);

  const handleSelect = useCallback(
    (gif: GifItem) => {
      onSelect(gif.fullUrl);
      onClose();
    },
    [onSelect, onClose],
  );

  if (!isOpen) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center"
      role="dialog"
      aria-label="Pick a GIF"
    >
      <div
        className="absolute inset-0 bg-[#121212]/60 sm:block hidden"
        aria-hidden
        onClick={onClose}
      />
      <div className="relative flex min-h-0 flex-1 flex-col border-2 sm:border-4 border-[#121212] bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0 sm:max-h-[70vh] sm:w-full sm:max-w-lg sm:flex-initial sm:shadow-[8px_8px_0px_0px_black]">
        <div className="flex shrink-0 items-center gap-2 border-b-2 border-[#121212] p-3">
          <input
            type="search"
            placeholder="Search GIFs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-10 flex-1 border-2 border-[#121212] bg-white px-4 py-2 text-sm text-[#121212] font-medium placeholder:text-[#888888] focus:outline-none focus:ring-2 focus:ring-[#1040C0]"
            autoFocus
          />
          <Button variant="outline" size="md" onClick={onClose}>
            Close
          </Button>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto p-3"
        >
          {loading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse bg-[#E0E0E0]"
                />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-[#888888]">
              No GIFs found. Try another search.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {results.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  className="overflow-hidden border-2 border-[#121212] outline-none transition hover:opacity-90 focus:ring-2 focus:ring-[#1040C0]"
                  onClick={() => handleSelect(gif)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
          {loadingMore ? (
            <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse bg-[#E0E0E0]"
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 border-t-2 border-[#121212] px-3 py-2 text-center">
          <a
            href="https://giphy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold uppercase tracking-wider text-[#888888] hover:text-[#D02020]"
          >
            Powered by GIPHY
          </a>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : overlay;
}
