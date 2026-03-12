-- When a participant is removed from a trip (kicked), delete their RSVPs for that trip's events.
create or replace function public.delete_rsvps_on_participant_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.event_rsvps
  where user_id = old.user_id
    and itinerary_item_id in (
      select id from public.itinerary_items where trip_id = old.trip_id
    );
  return old;
end;
$$;

drop trigger if exists trip_participants_delete_rsvps on public.trip_participants;
create trigger trip_participants_delete_rsvps
  after delete on public.trip_participants
  for each row execute function public.delete_rsvps_on_participant_removed();
