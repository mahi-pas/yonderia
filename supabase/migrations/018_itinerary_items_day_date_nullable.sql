-- Allow itinerary items that are not tied to a specific trip day (e.g. ideas / TBD stops).
alter table public.itinerary_items
  alter column day_date drop not null;
