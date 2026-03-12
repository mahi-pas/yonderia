drop policy if exists "organizers can update non organizer participant nicknames" on public.trip_participants;

create policy "organizers can update non organizer participant nicknames"
  on public.trip_participants
  for update
  using (
    public.get_trip_role(trip_id) = 'organizer'
    and user_id <> auth.uid()
    and role <> 'organizer'
  )
  with check (
    exists (
      select 1
      from public.trip_participants as existing
      where existing.id = trip_participants.id
        and public.get_trip_role(existing.trip_id) = 'organizer'
        and existing.user_id <> auth.uid()
        and existing.role <> 'organizer'
        and existing.trip_id = trip_participants.trip_id
        and existing.user_id = trip_participants.user_id
        and existing.role = trip_participants.role
        and existing.arrival_time is not distinct from trip_participants.arrival_time
        and existing.departure_time is not distinct from trip_participants.departure_time
        and existing.arrival_location is not distinct from trip_participants.arrival_location
        and existing.departure_location is not distinct from trip_participants.departure_location
        and existing.joined_at = trip_participants.joined_at
        and existing.created_at = trip_participants.created_at
    )
  );
