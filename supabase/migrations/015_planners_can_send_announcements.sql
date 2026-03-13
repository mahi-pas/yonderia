-- Allow planners to send announcements (in addition to organizers)
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
      (itinerary_item_id is not null and trip_id = (select trip_id from public.itinerary_items where id = itinerary_item_id))
      or
      (itinerary_item_id is null and (not is_announcement or public.get_trip_role(trip_id) in ('organizer', 'planner')))
    )
  );
