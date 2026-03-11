drop policy if exists "organizers can kick non organizers"
  on public.trip_participants;

create policy "organizers and planners can kick allowed participants"
  on public.trip_participants
  for delete
  using (
    (
      public.get_trip_role(trip_id) = 'organizer'
      and user_id <> auth.uid()
      and role <> 'organizer'
    )
    or (
      public.get_trip_role(trip_id) = 'planner'
      and role = 'member'
    )
  );
