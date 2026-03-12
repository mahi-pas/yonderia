-- Event RSVPs: participants can indicate going / interested / not going per event
create table public.event_rsvps (
  id uuid default gen_random_uuid() primary key,
  itinerary_item_id uuid references public.itinerary_items(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null check (status in ('going', 'interested', 'not_going')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (itinerary_item_id, user_id)
);

create index idx_event_rsvps_item on public.event_rsvps(itinerary_item_id);
create index idx_event_rsvps_user on public.event_rsvps(user_id);

-- Keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger event_rsvps_updated_at
  before update on public.event_rsvps
  for each row execute function public.set_updated_at();

alter table public.event_rsvps enable row level security;

-- SELECT: any trip participant can read RSVPs for items in their trip
create policy "trip participants can read event rsvps"
  on public.event_rsvps
  for select
  using (
    public.is_trip_participant(
      (select trip_id from public.itinerary_items where id = event_rsvps.itinerary_item_id)
    )
  );

-- INSERT: any trip participant can create their own RSVP (user_id must match auth.uid())
create policy "trip participants can create own rsvp"
  on public.event_rsvps
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_trip_participant(
      (select trip_id from public.itinerary_items where id = itinerary_item_id)
    )
  );

-- UPDATE: users can only update their own RSVP
create policy "users can update own rsvp"
  on public.event_rsvps
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: users can only delete their own RSVP
create policy "users can delete own rsvp"
  on public.event_rsvps
  for delete
  using (user_id = auth.uid());

-- Realtime: allow live count updates
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_rsvps'
  ) then
    alter publication supabase_realtime add table public.event_rsvps;
  end if;
end
$$;
