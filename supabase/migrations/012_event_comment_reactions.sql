-- Emoji reactions on event comments (one row per user per emoji per comment)
create table public.event_comment_reactions (
  id uuid default gen_random_uuid() primary key,
  comment_id uuid references public.event_comments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now() not null,
  unique (comment_id, user_id, emoji),
  check (char_length(emoji) >= 1 and char_length(emoji) <= 10)
);

create index idx_event_comment_reactions_comment on public.event_comment_reactions(comment_id);
create index idx_event_comment_reactions_user on public.event_comment_reactions(user_id);

alter table public.event_comment_reactions enable row level security;

-- Helper: trip_id for a comment (via itinerary_items)
create or replace function public.event_comment_trip_id(comment_uuid uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select trip_id
  from public.event_comments ec
  join public.itinerary_items ii on ii.id = ec.itinerary_item_id
  where ec.id = comment_uuid
  limit 1;
$$;

-- SELECT: trip participants can read reactions on comments in their trip
create policy "trip participants can read comment reactions"
  on public.event_comment_reactions
  for select
  using (
    public.is_trip_participant(public.event_comment_trip_id(comment_id))
  );

-- INSERT: trip participants can add their own reaction (user_id must match auth.uid())
create policy "trip participants can add comment reaction"
  on public.event_comment_reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_trip_participant(public.event_comment_trip_id(comment_id))
  );

-- DELETE: users can only remove their own reaction
create policy "users can delete own comment reaction"
  on public.event_comment_reactions
  for delete
  using (user_id = auth.uid());

-- Realtime: live reaction updates
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_comment_reactions'
  ) then
    alter publication supabase_realtime add table public.event_comment_reactions;
  end if;
end
$$;
