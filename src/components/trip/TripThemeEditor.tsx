"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ImageUploader from "@/components/ui/ImageUploader";
import Input, { inputClassName } from "@/components/ui/Input";
import BackgroundEffects from "@/components/trip/BackgroundEffects";
import TripThemeProvider from "@/components/trip/TripThemeProvider";
import type {
  TripTheme,
  TripThemeBackgroundType,
  TripThemeCardStyle,
  TripThemeEffect,
} from "@/lib/types";

const GOOGLE_FONTS = [
  "Space Grotesk",
  "Clash Display",
  "DM Sans",
  "Plus Jakarta Sans",
  "Playfair Display",
  "Libre Baskerville",
  "Sora",
  "Outfit",
  "Inter Tight",
  "Bricolage Grotesque",
  "Crimson Pro",
  "Oswald",
  "Raleway",
  "Work Sans",
  "Archivo",
] as const;

const DEFAULT_THEME: TripTheme = {};

const EFFECT_OPTIONS: { value: TripThemeEffect; label: string }[] = [
  { value: "none", label: "None" },
  { value: "confetti", label: "Confetti" },
  { value: "sparkles", label: "Sparkles" },
  { value: "snow", label: "Snow" },
  { value: "fireflies", label: "Fireflies" },
  { value: "aurora", label: "Aurora" },
];

const CARD_STYLE_OPTIONS: { value: TripThemeCardStyle; label: string }[] = [
  { value: "glass", label: "Glass" },
  { value: "solid", label: "Solid" },
  { value: "outline", label: "Outline" },
];

type TripThemeEditorProps = {
  initialTheme: TripTheme | null;
  tripId: string;
  tripName: string;
};

function buildGradientValue(
  startHex: string,
  endHex: string,
  direction: string,
): string {
  const dirMap: Record<string, string> = {
    "to-b": "180deg",
    "to-r": "90deg",
    "to-br": "135deg",
    "to-tr": "45deg",
  };
  const deg = dirMap[direction] || "180deg";
  return `linear-gradient(${deg}, ${startHex}, ${endHex})`;
}

export default function TripThemeEditor({
  initialTheme,
  tripId,
  tripName,
}: TripThemeEditorProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<TripTheme>(() => initialTheme ?? {});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [bgImageState, setBgImageState] = useState<{ path: string; publicUrl: string } | null>(
    () =>
      initialTheme?.background?.type === "image" && initialTheme.background.value
        ? { path: "", publicUrl: initialTheme.background.value }
        : null,
  );
  const [isImageUploading, setIsImageUploading] = useState(false);

  const updateTheme = useCallback((updater: (prev: TripTheme) => TripTheme) => {
    setTheme((prev) => updater(prev));
  }, []);

  const handleBackgroundType = (type: TripThemeBackgroundType) => {
    updateTheme((prev) => {
      const next = { ...prev };
      if (type === "gradient") {
        next.background = {
          type: "gradient",
          value: buildGradientValue("#1a0a2e", "#0f1a2e", "to-b"),
          overlay_opacity: prev.background?.overlay_opacity ?? 0,
        };
      } else if (type === "solid") {
        next.background = {
          type: "solid",
          value: "#0a0a0f",
          overlay_opacity: 0,
        };
      } else {
        next.background = {
          type: "image",
          value: bgImageState?.publicUrl ?? "",
          overlay_opacity: prev.background?.overlay_opacity ?? 0,
        };
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    const toSave = { ...theme };
    if (theme.background?.type === "image" && bgImageState?.publicUrl) {
      toSave.background = {
        ...toSave.background!,
        value: bgImageState.publicUrl,
      };
    }
    try {
      const res = await fetch(`/api/trip/${tripId}/theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: toSave }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save theme.");
      }
      router.push(`/trip/${tripId}`);
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not save theme. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setTheme(DEFAULT_THEME);
    setBgImageState(null);
  };

  const previewTheme = useMemo((): TripTheme => {
    if (theme.background?.type === "image" && bgImageState?.publicUrl) {
      return {
        ...theme,
        background: { ...theme.background, value: bgImageState.publicUrl },
      };
    }
    return theme;
  }, [theme, bgImageState?.publicUrl]);

  return (
    <main className="page-bg min-h-screen px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Customize theme
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-[#fafafa] sm:text-4xl">
              {tripName}
            </h1>
            <p className="mt-2 text-sm text-[#d4d4d8]">
              Change background, fonts, accent color, and effects. Everyone on the trip will see this.
            </p>
          </div>
          <Link
            href={`/trip/${tripId}/edit`}
            className="text-sm font-medium text-[var(--accent)] underline underline-offset-4 hover:text-[var(--accent)]/90"
          >
            Back to edit trip
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 backdrop-blur-sm">
            <h2 className="font-display text-lg font-semibold text-[#fafafa]">
              Background
            </h2>
            <div className="flex flex-wrap gap-3">
              {(["solid", "gradient", "image"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`rounded-xl border px-4 py-2 text-sm font-medium capitalize transition ${
                    theme.background?.type === type
                      ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[#fafafa]"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] text-[#d4d4d8] hover:border-[var(--border-strong)]"
                  }`}
                  onClick={() => handleBackgroundType(type)}
                >
                  {type}
                </button>
              ))}
            </div>

            {theme.background?.type === "gradient" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm text-[#d4d4d8]">Start color</span>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]"
                    value={
                      (theme.background.value?.match(/#[0-9a-fA-F]{6}/g)?.[0]) ?? "#1a0a2e"
                    }
                    onChange={(e) => {
                      const start = e.target.value;
                      const hexes = theme.background?.value?.match(/#[0-9a-fA-F]{6}/g);
                      const end = hexes?.[1] ?? "#0f1a2e";
                      updateTheme((prev) => ({
                        ...prev,
                        background: {
                          ...prev.background!,
                          value: buildGradientValue(start, end, "to-b"),
                        },
                      }));
                    }}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm text-[#d4d4d8]">End color</span>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]"
                    value={
                      (theme.background?.value?.match(/#[0-9a-fA-F]{6}/g)?.[1]) ?? "#0f1a2e"
                    }
                    onChange={(e) => {
                      const end = e.target.value;
                      const hexes = theme.background?.value?.match(/#[0-9a-fA-F]{6}/g);
                      const start = hexes?.[0] ?? "#1a0a2e";
                      updateTheme((prev) => ({
                        ...prev,
                        background: {
                          ...prev.background!,
                          value: buildGradientValue(start, end, "to-b"),
                        },
                      }));
                    }}
                  />
                </label>
              </div>
            ) : null}

            {theme.background?.type === "image" ? (
              <ImageUploader
                bucket="trip-images"
                disabled={isSaving}
                initialImageUrl={bgImageState?.publicUrl ?? null}
                pathPrefix={`${tripId}/theme-bg`}
                onChange={setBgImageState}
                onUploadingChange={setIsImageUploading}
              />
            ) : null}

            {theme.background?.type === "solid" ? (
              <label className="block space-y-1">
                <span className="text-sm text-[#d4d4d8]">Color</span>
                <input
                  type="color"
                  className="h-10 w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]"
                  value={theme.background?.value ?? "#0a0a0f"}
                  onChange={(e) =>
                    updateTheme((prev) => ({
                      ...prev,
                      background: {
                        type: "solid",
                        value: e.target.value,
                        overlay_opacity: prev.background?.overlay_opacity ?? 0,
                      },
                    }))
                  }
                />
              </label>
            ) : null}

            {(theme.background?.type === "gradient" ||
              theme.background?.type === "image") && (
              <label className="block space-y-2">
                <span className="text-sm text-[#d4d4d8]">
                  Overlay opacity: {(theme.background?.overlay_opacity ?? 0).toFixed(2)}
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  className="w-full accent-[var(--accent)]"
                  value={theme.background?.overlay_opacity ?? 0}
                  onChange={(e) =>
                    updateTheme((prev) => ({
                      ...prev,
                      background: {
                        ...prev.background!,
                        overlay_opacity: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </label>
            )}
          </section>

          <section className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 backdrop-blur-sm">
            <h2 className="font-display text-lg font-semibold text-[#fafafa]">
              Fonts
            </h2>
            <label className="block space-y-2">
              <span className="text-sm text-[#d4d4d8]">Display font</span>
              <select
                className={inputClassName("cursor-pointer")}
                value={theme.font?.display ?? ""}
                onChange={(e) =>
                  updateTheme((prev) => ({
                    ...prev,
                    font: {
                      display: e.target.value,
                      body: prev.font?.body ?? "",
                    },
                  }))
                }
              >
                <option value="">Default</option>
                {GOOGLE_FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[#d4d4d8]">Body font</span>
              <select
                className={inputClassName("cursor-pointer")}
                value={theme.font?.body ?? ""}
                onChange={(e) =>
                  updateTheme((prev) => ({
                    ...prev,
                    font: {
                      display: prev.font?.display ?? "",
                      body: e.target.value,
                    },
                  }))
                }
              >
                <option value="">Default</option>
                {GOOGLE_FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 backdrop-blur-sm">
            <h2 className="font-display text-lg font-semibold text-[#fafafa]">
              Accent color
            </h2>
            <div className="flex items-center gap-4">
              <input
                type="color"
                className="h-12 w-20 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]"
                value={theme.accent_color ?? "#8b5cf6"}
                onChange={(e) =>
                  updateTheme((prev) => ({ ...prev, accent_color: e.target.value }))
                }
              />
              <span className="text-sm text-[#d4d4d8]">
                Buttons, badges, and links
              </span>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 backdrop-blur-sm">
            <h2 className="font-display text-lg font-semibold text-[#fafafa]">
              Special effect
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {EFFECT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-xl border p-4 text-left text-sm font-medium transition ${
                    theme.effect === value
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[#fafafa]"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] text-[#d4d4d8] hover:border-[var(--border-strong)]"
                  }`}
                  onClick={() =>
                    updateTheme((prev) => ({ ...prev, effect: value }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 backdrop-blur-sm">
            <h2 className="font-display text-lg font-semibold text-[#fafafa]">
              Card style
            </h2>
            <div className="flex flex-wrap gap-3">
              {CARD_STYLE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    theme.card_style === value
                      ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[#fafafa]"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] text-[#d4d4d8] hover:border-[var(--border-strong)]"
                  }`}
                  onClick={() =>
                    updateTheme((prev) => ({ ...prev, card_style: value }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 backdrop-blur-sm">
          <h2 className="font-display text-lg font-semibold text-[#fafafa]">
            Live preview
          </h2>
          <p className="mt-1 text-sm text-[#d4d4d8]">
            A mini preview of your trip page with the current theme.
          </p>
          <div className="relative mt-4 h-[280px] overflow-hidden rounded-xl border border-[var(--border)]">
            <TripThemeProvider theme={previewTheme}>
              <div className="absolute inset-0 p-4">
                <BackgroundEffects effect={previewTheme.effect ?? "none"} />
                <div
                  className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3 backdrop-blur-sm"
                  style={{
                    ...(previewTheme.card_style === "solid" && {
                      background: "rgba(20,20,31,0.95)",
                    }),
                    ...(previewTheme.card_style === "outline" && {
                      background: "transparent",
                      borderWidth: "2px",
                    }),
                  }}
                >
                  <p
                    className="font-display text-lg font-semibold text-[#fafafa]"
                    style={
                      previewTheme.font?.display
                        ? { fontFamily: `"${previewTheme.font.display}", sans-serif` }
                        : undefined
                    }
                  >
                    {tripName}
                  </p>
                  <p
                    className="mt-1 text-xs text-[#d4d4d8]"
                    style={
                      previewTheme.font?.body
                        ? { fontFamily: `"${previewTheme.font.body}", sans-serif` }
                        : undefined
                    }
                  >
                    Trip dates · Location
                  </p>
                  <button
                    type="button"
                    className="mt-3 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                    style={{
                      background: previewTheme.accent_color ?? "#8b5cf6",
                    }}
                  >
                    Accent button
                  </button>
                </div>
              </div>
            </TripThemeProvider>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-[#ef4444]/30 bg-[#450a0a]/90 px-4 py-3 text-sm text-[#fca5a5]">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            disabled={isSaving || isImageUploading}
            isLoading={isSaving}
            size="lg"
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving..." : "Save theme"}
          </Button>
          <Button variant="secondary" size="lg" onClick={handleReset}>
            Reset to default
          </Button>
          <Link href={`/trip/${tripId}`}>
            <Button variant="ghost" size="lg">
              Cancel
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
