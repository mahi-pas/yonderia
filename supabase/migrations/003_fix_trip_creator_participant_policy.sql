create or replace function public.is_trip_creator(trip_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips
    where id = trip_uuid and created_by = auth.uid()
  );
$$;

drop policy if exists "trip creators can add their organizer participant row"
  on public.trip_participants;

create policy "trip creators can add their organizer participant row"
  on public.trip_participants
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'organizer'
    and public.is_trip_creator(trip_id)
  );
