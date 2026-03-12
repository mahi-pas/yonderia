"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [selected, setSelected] = useState<GifItem | null>(null);
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
      setSelected(null);
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

  const handleSelect = useCallback((gif: GifItem) => {
    setSelected(gif);
  }, []);

  const handleSend = useCallback(() => {
    if (selected) {
      onSelect(selected.fullUrl);
      setSelected(null);
      onClose();
    }
  }, [selected, onSelect, onClose]);

  const handleCancel = useCallback(() => {
    setSelected(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-label="Pick a GIF"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--border)] border-b-0 bg-[var(--surface)] shadow-xl sm:max-h-[70vh] sm:rounded-2xl sm:border-b">
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] p-3">
          <input
            type="search"
            placeholder="Search GIFs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-10 flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 py-2 text-sm text-[#fafafa] placeholder:text-[var(--muted-foreground)] focus:border-[#8b5cf6] focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20"
            autoFocus
          />
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        </div>

        {selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.fullUrl}
              alt="Selected GIF"
              className="max-h-48 max-w-full rounded-xl object-contain"
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSend}>Send</Button>
            </div>
          </div>
        ) : (
          <>
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
                      className="aspect-square animate-pulse rounded-lg bg-[var(--surface-elevated)]"
                    />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                  No GIFs found. Try another search.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {results.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      className="focus:ring-2 focus:ring-[#8b5cf6]/30 focus:ring-offset-2 focus:ring-offset-[var(--surface)] rounded-lg overflow-hidden outline-none transition hover:opacity-90"
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
                      className="aspect-square animate-pulse rounded-lg bg-[var(--surface-elevated)]"
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="shrink-0 border-t border-[var(--border)] px-3 py-2 text-center">
              <a
                href="https://giphy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--muted-foreground)] hover:underline"
              >
                Powered by GIPHY
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
