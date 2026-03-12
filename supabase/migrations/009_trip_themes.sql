-- Per-trip custom themes: background, fonts, accent, effects, card style.
-- RLS: trip participants can read trips (including theme). Only trip creator (organizer) can update trips (including theme) via existing "trip creators can update trips" policy.

alter table public.trips
  add column if not exists theme jsonb not null default '{}'::jsonb;

comment on column public.trips.theme is 'Custom theme: background (type, value, overlay_opacity), font (display, body), accent_color, effect (none|confetti|sparkles|snow|fireflies|aurora), card_style (glass|solid|outline).';
