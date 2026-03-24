"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useTripNavThemeSetter } from "@/components/navigation/TripNavThemeContext";
import type { TripTheme } from "@/lib/types";

/** CSS variables for the trip theme. Used by portaled content (e.g. event detail modal) so they inherit the theme. */
export const TripThemeStyleContext = createContext<React.CSSProperties & Record<string, string> | null>(null);

export function useTripThemeStyle(): (React.CSSProperties & Record<string, string>) | null {
  return useContext(TripThemeStyleContext);
}

const DEFAULT_BG = "var(--background)";
const DEFAULT_ACCENT = "#D02020";
const DEFAULT_FONT_DISPLAY = "var(--font-display)";
const DEFAULT_FONT_BODY = "var(--font-sans)";

function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function buildThemeBackgroundStyle(
  theme: TripTheme | null | undefined
): {
  backgroundImage: string;
  backgroundColor: string;
  backgroundSize: string;
  backgroundPosition: string;
} {
  const result = {
    backgroundImage: "none",
    backgroundColor: DEFAULT_BG,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  if (!theme?.background?.type || !theme.background.value) {
    return result;
  }
  const { type, value } = theme.background;
  if (type === "solid") {
    result.backgroundColor = value;
    return result;
  }
  if (type === "image") {
    result.backgroundImage = `url("${value.replace(/"/g, "%22")}")`;
    return result;
  }
  // gradient
  result.backgroundImage = value;
  return result;
}

function buildGoogleFontsUrl(display: string, body: string): string {
  const families = Array.from(new Set([
    display.replace(/ /g, "+"),
    body.replace(/ /g, "+"),
  ].filter(Boolean)));
  if (families.length === 0) return "";
  const query = new URLSearchParams();
  for (const family of families) {
    query.append("family", `${family}:wght@400;500;600;700`);
  }
  query.set("display", "swap");
  return `https://fonts.googleapis.com/css2?${query.toString()}`;
}

type TripThemeProviderProps = {
  children: React.ReactNode;
  /** When false, theme is not pushed to the app header (e.g. theme editor preview). Default true. */
  applyToAppNavigation?: boolean;
  theme: TripTheme | null | undefined;
};

export default function TripThemeProvider({
  children,
  theme,
  applyToAppNavigation = true,
}: TripThemeProviderProps) {
  const setNavThemeStyle = useTripNavThemeSetter();
  const hasCustomFonts =
    theme?.font?.display?.trim() || theme?.font?.body?.trim();
  const fontUrl = useMemo(() => {
    if (!hasCustomFonts) return null;
    return buildGoogleFontsUrl(
      theme?.font?.display?.trim() || "Inter",
      theme?.font?.body?.trim() || "Inter",
    );
  }, [theme?.font?.display, theme?.font?.body, hasCustomFonts]);

  const style = useMemo(() => {
    const bgStyle = buildThemeBackgroundStyle(theme);
    const bg =
      bgStyle.backgroundImage !== "none"
        ? bgStyle.backgroundImage
        : bgStyle.backgroundColor;
    const overlay = theme?.background?.overlay_opacity ?? 0;
    const accent = theme?.accent_color?.trim() || DEFAULT_ACCENT;
    const displayFont = theme?.font?.display?.trim()
      ? `"${theme.font.display.replace(/"/g, '\\"')}", sans-serif`
      : DEFAULT_FONT_DISPLAY;
    const bodyFont = theme?.font?.body?.trim()
      ? `"${theme.font.body.replace(/"/g, '\\"')}", sans-serif`
      : DEFAULT_FONT_BODY;
    const cardStyle = theme?.card_style || "glass";

    const base: React.CSSProperties & Record<string, string> = {
      "--accent": accent,
      "--accent-gradient": `linear-gradient(135deg, ${accent}, ${accent}dd)`,
      "--font-display": displayFont,
      "--font-sans": bodyFont,
      "--trip-bg": bg,
      "--trip-bg-overlay": String(overlay),
      "--trip-accent": accent,
      "--trip-accent-gradient": `linear-gradient(135deg, ${accent}, ${accent}dd)`,
      "--trip-font-display": displayFont,
      "--trip-font-body": bodyFont,
      "--trip-card-style": cardStyle,
    };

    // Thematic surface, text, and border so cards/buttons match the trip theme
    const surface = theme?.surface_color?.trim();
    const surfaceElevated = theme?.surface_elevated_color?.trim();
    const surfaceForeground = theme?.surface_foreground?.trim();
    const textPrimary = theme?.text_primary?.trim();
    const textSecondary = theme?.text_secondary?.trim();
    const textAccent = theme?.text_accent?.trim();
    const borderColor = theme?.border_color?.trim();

    // When theme has a custom background, override --background so .page-bg doesn't paint over it
    const hasCustomBg = Boolean(theme?.background?.type && theme.background.value);
    if (hasCustomBg) {
      base["--background"] = "transparent";
    }
    if (surface) {
      base["--surface"] = surface;
      base["--surface-elevated"] = surfaceElevated || surface;
    } else if (hasCustomBg) {
      base["--surface"] = "#2d2a1e";
      base["--surface-elevated"] = "#3a3628";
    }
    // Text on cards: when using theme surface, default to light text so it's readable on dark cards
    if (surface || hasCustomBg) {
      base["--surface-foreground"] = surfaceForeground || "#fafafa";
      base["--surface-muted"] = "rgba(250,250,250,0.85)";
    }
    if (textPrimary) {
      base["--foreground"] = textPrimary;
    } else if (hasCustomBg) {
      // Auto-calculate text color for contrast when background is custom but text colors aren't explicit
      const bgValue = theme?.background?.value ?? "";
      if (theme?.background?.type === "solid" && isHexColor(bgValue)) {
        const isDark = getLuminance(bgValue) < 0.4;
        base["--foreground"] = isDark ? "#fafafa" : "#121212";
      } else if (hasCustomBg) {
        // For gradients and images without explicit text, assume dark background
        base["--foreground"] = "#fafafa";
      }
    }
    if (textSecondary) {
      base["--muted-foreground"] = textSecondary;
      base["--muted"] = textSecondary;
    } else if (hasCustomBg && !textSecondary) {
      const bgValue = theme?.background?.value ?? "";
      if (theme?.background?.type === "solid" && isHexColor(bgValue)) {
        const isDark = getLuminance(bgValue) < 0.4;
        base["--muted-foreground"] = isDark ? "#a1a1aa" : "#666666";
        base["--muted"] = isDark ? "#a1a1aa" : "#666666";
      } else {
        base["--muted-foreground"] = "#a1a1aa";
        base["--muted"] = "#a1a1aa";
      }
    }
    if (textAccent) {
      base["--accent"] = textAccent;
      base["--accent-gradient"] = `linear-gradient(135deg, ${textAccent}, ${textAccent}dd)`;
      base["--trip-accent"] = textAccent;
      base["--trip-accent-gradient"] = `linear-gradient(135deg, ${textAccent}, ${textAccent}dd)`;
    }
    if (borderColor) {
      base["--border"] = borderColor + "40";
      base["--border-strong"] = borderColor + "60";
    }

    // Fixed light surfaces (modals, white punch-out rows) must not use page --foreground,
    // which becomes light on dark trip backgrounds.
    base["--trip-paper-text"] = "#121212";
    base["--trip-paper-muted"] = "#666666";

    const pageFg = base["--foreground"];
    const pageMuted = base["--muted-foreground"];
    const surfFg = base["--surface-foreground"];
    const surfMuted = base["--surface-muted"];

    if (cardStyle === "solid") {
      base["--trip-card-text"] = surfFg ?? pageFg ?? "#fafafa";
      base["--trip-card-text-muted"] = surfMuted ?? pageMuted ?? "#a1a1aa";
    } else if (cardStyle === "outline") {
      if (pageFg) base["--trip-card-text"] = pageFg;
      if (pageMuted) base["--trip-card-text-muted"] = pageMuted;
    } else {
      base["--trip-card-text"] = "#121212";
      base["--trip-card-text-muted"] = "#666666";
    }

    return base;
  }, [theme]);

  useEffect(() => {
    if (!applyToAppNavigation) {
      return;
    }
    setNavThemeStyle(style);
    return () => {
      setNavThemeStyle(null);
    };
  }, [applyToAppNavigation, setNavThemeStyle, style]);

  // Override body background so the theme extends to the full page (no white bleed at edges)
  useEffect(() => {
    const hasCustomBg = Boolean(theme?.background?.type && theme.background.value);
    if (!hasCustomBg) return;
    const prev = document.body.style.background;
    document.body.style.background = "transparent";
    return () => {
      document.body.style.background = prev;
    };
  }, [theme?.background?.type, theme?.background?.value]);

  useEffect(() => {
    if (!fontUrl) return;
    const link = document.createElement("link");
    link.href = fontUrl;
    link.rel = "stylesheet";
    link.setAttribute("data-trip-theme-fonts", "true");
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [fontUrl]);

  const cardStyle = theme?.card_style ?? "glass";
  const bgStyle = useMemo(
    () => buildThemeBackgroundStyle(theme),
    [theme]
  );

  const rootStyle = useMemo(() => ({
    ...style,
    ...bgStyle,
  }), [style, bgStyle]);

  /** Tall enough for mobile AppShell nav + safe area; sits under main (z-10) so gutters behind fixed nav match the trip canvas. */
  const mobileNavBackdropHeight =
    "calc(6.75rem + env(safe-area-inset-bottom, 0px))";

  return (
    <TripThemeStyleContext.Provider value={style}>
    <div
      className="trip-theme-root relative isolate min-h-screen"
      data-card-style={cardStyle}
      style={rootStyle}
    >
      {Number(style["--trip-bg-overlay"]) > 0 ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 min-h-screen bg-black"
          style={{
            opacity: Number(style["--trip-bg-overlay"]),
          }}
        />
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[5] overflow-hidden md:hidden"
        style={{
          height: mobileNavBackdropHeight,
          backgroundImage: bgStyle.backgroundImage,
          backgroundColor: bgStyle.backgroundColor,
          backgroundSize: bgStyle.backgroundSize,
          backgroundPosition: bgStyle.backgroundPosition,
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(#121212 1.5px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>
      {Number(style["--trip-bg-overlay"]) > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[6] bg-black md:hidden"
          style={{
            height: mobileNavBackdropHeight,
            opacity: Number(style["--trip-bg-overlay"]),
          }}
        />
      ) : null}
      {children}
    </div>
    </TripThemeStyleContext.Provider>
  );
}
