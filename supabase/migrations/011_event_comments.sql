-- Event comments: participants can discuss event details with optional GIFs
create table public.event_comments (
  id uuid default gen_random_uuid() primary key,
  itinerary_item_id uuid references public.itinerary_items(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text,
  gif_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  check (content is not null or gif_url is not null)
);

create index idx_event_comments_item on public.event_comments(itinerary_item_id);
create index idx_event_comments_created on public.event_comments(created_at);

-- Keep updated_at in sync (reuse if trigger exists)
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

create trigger event_comments_updated_at
  before update on public.event_comments
  for each row execute function public.set_updated_at();

alter table public.event_comments enable row level security;

-- SELECT: any trip participant can read comments on items in their trip
create policy "trip participants can read event comments"
  on public.event_comments
  for select
  using (
    public.is_trip_participant(
      (select trip_id from public.itinerary_items where id = event_comments.itinerary_item_id)
    )
  );

-- INSERT: any trip participant can create comments (user_id must match auth.uid())
create policy "trip participants can create event comments"
  on public.event_comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_trip_participant(
      (select trip_id from public.itinerary_items where id = itinerary_item_id)
    )
  );

-- UPDATE: users can only update their own comments
create policy "users can update own event comment"
  on public.event_comments
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: users can delete their own comments; organizers can delete any comment in their trip
create policy "users can delete own event comment"
  on public.event_comments
  for delete
  using (user_id = auth.uid());

create policy "organizers can delete any event comment in trip"
  on public.event_comments
  for delete
  using (
    public.get_trip_role(
      (select trip_id from public.itinerary_items where id = event_comments.itinerary_item_id)
    ) = 'organizer'
  );

-- Realtime: live comment updates
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_comments'
  ) then
    alter publication supabase_realtime add table public.event_comments;
  end if;
end
$$;
