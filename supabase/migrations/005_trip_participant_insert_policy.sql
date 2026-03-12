drop policy if exists "organizers can add planner and member participants" on public.trip_participants;

create policy "organizers can add planner and member participants"
  on public.trip_participants
  for insert
  to authenticated
  with check (
    public.get_trip_role(trip_id) = 'organizer'
    and user_id <> auth.uid()
    and role in ('planner', 'member')
  );
