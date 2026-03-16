import type {
  TripTheme,
  TripThemeBackgroundType,
  TripThemeCardStyle,
  TripThemeEffect,
} from "@/lib/types";

const BACKGROUND_TYPES: TripThemeBackgroundType[] = ["gradient", "image", "solid"];
const EFFECTS: TripThemeEffect[] = ["none", "confetti", "sparkles", "snow", "fireflies", "aurora"];
const CARD_STYLES: TripThemeCardStyle[] = ["glass", "solid", "outline"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateTripTheme(payload: unknown): { ok: true; theme: TripTheme } | { ok: false; error: string } {
  if (!isRecord(payload)) {
    return { ok: false, error: "Theme must be an object." };
  }

  const theme: TripTheme = {};

  if (Object.prototype.hasOwnProperty.call(payload, "background")) {
    const bg = payload.background;
    if (!isRecord(bg)) {
      return { ok: false, error: "Theme background must be an object." };
    }
    const type = bg.type;
    if (typeof type !== "string" || !BACKGROUND_TYPES.includes(type as TripThemeBackgroundType)) {
      return { ok: false, error: "Theme background type must be one of: gradient, image, solid." };
    }
    const value = bg.value;
    if (typeof value !== "string") {
      return { ok: false, error: "Theme background value must be a string." };
    }
    const dangerous = /javascript:|data:(?!image\/)/i;
    if (dangerous.test(value)) {
      return { ok: false, error: "Theme background value contains disallowed content." };
    }
    if (type === "image") {
      const trimmed = value.trim();
      if (trimmed && !/^https:\/\//i.test(trimmed) && !/^data:image\//i.test(trimmed)) {
        return { ok: false, error: "Theme background image value must be an https URL or data:image URI." };
      }
    }
    let overlay_opacity: number | undefined;
    if (Object.prototype.hasOwnProperty.call(bg, "overlay_opacity")) {
      const o = bg.overlay_opacity;
      if (typeof o !== "number" || o < 0 || o > 1) {
        return { ok: false, error: "Theme background overlay_opacity must be a number between 0 and 1." };
      }
      overlay_opacity = o;
    }
    theme.background = { type: type as TripThemeBackgroundType, value, overlay_opacity };
  }

  if (Object.prototype.hasOwnProperty.call(payload, "font")) {
    const font = payload.font;
    if (!isRecord(font)) {
      return { ok: false, error: "Theme font must be an object." };
    }
    const display = typeof font.display === "string" ? font.display : "";
    const body = typeof font.body === "string" ? font.body : "";
    theme.font = { display, body };
  }

  if (Object.prototype.hasOwnProperty.call(payload, "accent_color")) {
    const v = payload.accent_color;
    if (typeof v !== "string") {
      return { ok: false, error: "Theme accent_color must be a string." };
    }
    theme.accent_color = v;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "effect")) {
    const v = payload.effect;
    if (typeof v !== "string" || !EFFECTS.includes(v as TripThemeEffect)) {
      return { ok: false, error: "Theme effect must be one of: none, confetti, sparkles, snow, fireflies, aurora." };
    }
    theme.effect = v as TripThemeEffect;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "card_style")) {
    const v = payload.card_style;
    if (typeof v !== "string" || !CARD_STYLES.includes(v as TripThemeCardStyle)) {
      return { ok: false, error: "Theme card_style must be one of: glass, solid, outline." };
    }
    theme.card_style = v as TripThemeCardStyle;
  }

  const hexColorKeys = [
    "surface_color",
    "surface_elevated_color",
    "surface_foreground",
    "text_primary",
    "text_secondary",
    "text_accent",
    "border_color",
  ] as const;
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  for (const key of hexColorKeys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const v = payload[key];
      if (typeof v !== "string") {
        return { ok: false, error: `Theme ${key} must be a string.` };
      }
      if (v.trim() && !hexRe.test(v.trim())) {
        return { ok: false, error: `Theme ${key} must be a 6-digit hex color (e.g. #1a1a2e).` };
      }
      const trimmed = v.trim();
      if (trimmed) theme[key] = trimmed;
    }
  }

  return { ok: true, theme };
}
