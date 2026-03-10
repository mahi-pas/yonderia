do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trip_participants'
  ) then
    alter publication supabase_realtime add table public.trip_participants;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'itinerary_items'
  ) then
    alter publication supabase_realtime add table public.itinerary_items;
  end if;
end
$$;
