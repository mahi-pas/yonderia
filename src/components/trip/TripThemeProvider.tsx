"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import type { TripTheme } from "@/lib/types";

/** CSS variables for the trip theme. Used by portaled content (e.g. event detail modal) so they inherit the theme. */
export const TripThemeStyleContext = createContext<React.CSSProperties & Record<string, string> | null>(null);

export function useTripThemeStyle(): (React.CSSProperties & Record<string, string>) | null {
  return useContext(TripThemeStyleContext);
}

const DEFAULT_BG = "var(--background)";
const DEFAULT_ACCENT = "#8b5cf6";
const DEFAULT_FONT_DISPLAY = "var(--font-display)";
const DEFAULT_FONT_BODY = "var(--font-sans)";

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
    result.backgroundImage = `url(${value})`;
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
  theme: TripTheme | null | undefined;
};

export default function TripThemeProvider({ children, theme }: TripThemeProviderProps) {
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

    // When theme has a custom background, use a warm default surface so cards don't clash (cold grey on orange)
    const hasCustomBg = Boolean(theme?.background?.type && theme.background.value);
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
    if (textPrimary) base["--foreground"] = textPrimary;
    if (textSecondary) {
      base["--muted-foreground"] = textSecondary;
      base["--muted"] = textSecondary;
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

    return base;
  }, [theme]);

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

  return (
    <TripThemeStyleContext.Provider value={style}>
    <div
      className="trip-theme-root relative isolate min-h-screen"
      data-card-style={cardStyle}
      style={style}
    >
      <div
        className="trip-theme-bg absolute inset-0 -z-10 min-h-screen"
        style={bgStyle}
      />
      {Number(style["--trip-bg-overlay"]) > 0 ? (
        <div
          className="pointer-events-none absolute inset-0 -z-[9] min-h-screen bg-black"
          style={{
            opacity: Number(style["--trip-bg-overlay"]),
          }}
        />
      ) : null}
      {children}
    </div>
    </TripThemeStyleContext.Provider>
  );
}
