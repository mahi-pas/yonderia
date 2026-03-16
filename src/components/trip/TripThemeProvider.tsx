"use client";

import { useEffect, useMemo } from "react";
import type { TripTheme } from "@/lib/types";

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

    return {
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
    } as React.CSSProperties & Record<string, string>;
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
  );
}
