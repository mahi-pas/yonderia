-- Trip-level comments and announcements: allow comments for the trip in general,
-- and announcements (organizer-only) that are pinned at the top.

-- Add trip_id so we can have comments not tied to an event (itinerary_item_id null)
alter table public.event_comments
  add column if not exists trip_id uuid references public.trips(id) on delete cascade;

-- Backfill trip_id from itinerary item
update public.event_comments ec
set trip_id = (select ii.trip_id from public.itinerary_items ii where ii.id = ec.itinerary_item_id)
where ec.trip_id is null and ec.itinerary_item_id is not null;

-- Require trip_id on all rows (existing and new)
alter table public.event_comments
  alter column trip_id set not null;

-- Allow trip-level comments (no event)
alter table public.event_comments
  alter column itinerary_item_id drop not null;

-- Announcements: organizer-only, must have content (no GIF-only)
alter table public.event_comments
  add column if not exists is_announcement boolean not null default false;

-- Constraint: content or gif for normal comments; announcements must have content
do $$
declare
  c name;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.event_comments'::regclass and contype = 'c'
  loop
    execute format('alter table public.event_comments drop constraint %I', c);
  end loop;
end $$;

alter table public.event_comments
  add constraint event_comments_content_or_gif_check check (
    (content is not null or gif_url is not null)
    and (not is_announcement or content is not null)
  );

create index if not exists idx_event_comments_trip on public.event_comments(trip_id);
create index if not exists idx_event_comments_trip_announcement on public.event_comments(trip_id, is_announcement) where is_announcement = true;

-- Helper: trip_id for a comment (now always on the row)
create or replace function public.event_comment_trip_id(comment_uuid uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select trip_id from public.event_comments where id = comment_uuid limit 1;
$$;

-- RLS: SELECT by trip participation
drop policy if exists "trip participants can read event comments" on public.event_comments;
create policy "trip participants can read event comments"
  on public.event_comments
  for select
  using (public.is_trip_participant(trip_id));

-- RLS: INSERT — event comment (itinerary_item_id set) or trip comment/announcement (itinerary_item_id null)
drop policy if exists "trip participants can create event comments" on public.event_comments;
create policy "trip participants can create event comments"
  on public.event_comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and trip_id is not null
    and public.is_trip_participant(trip_id)
    and (
      -- Event comment: trip_id must match the item's trip
      (itinerary_item_id is not null and trip_id = (select trip_id from public.itinerary_items where id = itinerary_item_id))
      or
      -- Trip-level comment or announcement: no event
      (itinerary_item_id is null and (not is_announcement or public.get_trip_role(trip_id) = 'organizer'))
    )
  );

-- RLS: DELETE organizer for any comment in trip (use trip_id)
drop policy if exists "organizers can delete any event comment in trip" on public.event_comments;
create policy "organizers can delete any event comment in trip"
  on public.event_comments
  for delete
  using (public.get_trip_role(trip_id) = 'organizer');
