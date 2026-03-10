create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  has_completed_onboarding boolean default false,
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  location_name text,
  latitude double precision,
  longitude double precision,
  start_date date not null,
  end_date date not null,
  default_planner_permission boolean default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade,
  code text unique not null,
  code_type text default 'join' check (code_type in ('join', 'join_planner', 'view')),
  is_active boolean default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.trip_participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  nickname text,
  role text default 'member' check (role in ('organizer', 'planner', 'member')),
  arrival_time timestamptz,
  departure_time timestamptz,
  arrival_location text,
  departure_location text,
  joined_at timestamptz default now(),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade,
  item_type text not null check (item_type in ('event', 'hotel', 'commute')),
  title text not null,
  description text,
  image_url text,
  day_date date not null,
  start_time timestamptz,
  end_time timestamptz,
  location_name text,
  latitude double precision,
  longitude double precision,
  destination_name text,
  destination_latitude double precision,
  destination_longitude double precision,
  sort_order integer default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_trip_participants_trip on public.trip_participants(trip_id);
create index idx_trip_participants_user on public.trip_participants(user_id);
create index idx_itinerary_items_trip_day on public.itinerary_items(trip_id, day_date);
create index idx_invite_codes_code on public.invite_codes(code);
create index idx_invite_codes_trip on public.invite_codes(trip_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_trip_participant(trip_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_participants
    where trip_id = trip_uuid and user_id = auth.uid()
  );
$$;

create or replace function public.get_trip_role(trip_uuid uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select role
  from public.trip_participants
  where trip_id = trip_uuid and user_id = auth.uid()
  limit 1;
$$;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.invite_codes enable row level security;
alter table public.trip_participants enable row level security;
alter table public.itinerary_items enable row level security;

create policy "profiles are readable by everyone"
  on public.profiles
  for select
  using (true);

create policy "users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users can create their own trips"
  on public.trips
  for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "trip participants can read trips"
  on public.trips
  for select
  using (public.is_trip_participant(id));

create policy "trip creators can update trips"
  on public.trips
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "trip creators can delete trips"
  on public.trips
  for delete
  using (created_by = auth.uid());

create policy "trip creators can add their organizer participant row"
  on public.trip_participants
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'organizer'
    and exists (
      select 1
      from public.trips
      where id = trip_id and created_by = auth.uid()
    )
  );

create policy "trip participants can read participant lists"
  on public.trip_participants
  for select
  using (public.is_trip_participant(trip_id));

create policy "users can update their own participant row"
  on public.trip_participants
  for update
  using (user_id = auth.uid())
  with check (
    exists (
      select 1
      from public.trip_participants as existing
      where existing.id = trip_participants.id
        and existing.user_id = auth.uid()
        and existing.trip_id = trip_participants.trip_id
        and existing.user_id = trip_participants.user_id
        and existing.role = trip_participants.role
        and existing.joined_at = trip_participants.joined_at
        and existing.created_at = trip_participants.created_at
    )
  );

create policy "organizers can update non organizer participant roles"
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
        and existing.nickname is not distinct from trip_participants.nickname
        and existing.arrival_time is not distinct from trip_participants.arrival_time
        and existing.departure_time is not distinct from trip_participants.departure_time
        and existing.arrival_location is not distinct from trip_participants.arrival_location
        and existing.departure_location is not distinct from trip_participants.departure_location
        and existing.joined_at = trip_participants.joined_at
        and existing.created_at = trip_participants.created_at
        and trip_participants.role in ('planner', 'member')
    )
  );

create policy "organizers can kick non organizers"
  on public.trip_participants
  for delete
  using (
    public.get_trip_role(trip_id) = 'organizer'
    and user_id <> auth.uid()
    and role <> 'organizer'
  );

create policy "participants can leave unless they are organizer"
  on public.trip_participants
  for delete
  using (
    user_id = auth.uid()
    and role <> 'organizer'
  );

create policy "organizers and planners can create invite codes"
  on public.invite_codes
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.get_trip_role(trip_id) in ('organizer', 'planner')
  );

create policy "organizers and planners can read invite codes"
  on public.invite_codes
  for select
  using (public.get_trip_role(trip_id) in ('organizer', 'planner'));

create policy "organizers can update invite codes"
  on public.invite_codes
  for update
  using (public.get_trip_role(trip_id) = 'organizer')
  with check (public.get_trip_role(trip_id) = 'organizer');

create policy "organizers can delete invite codes"
  on public.invite_codes
  for delete
  using (public.get_trip_role(trip_id) = 'organizer');

create policy "participants can read itinerary items"
  on public.itinerary_items
  for select
  using (public.is_trip_participant(trip_id));

create policy "organizers and planners can create itinerary items"
  on public.itinerary_items
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.get_trip_role(trip_id) in ('organizer', 'planner')
  );

create policy "organizers and planners can update itinerary items"
  on public.itinerary_items
  for update
  using (public.get_trip_role(trip_id) in ('organizer', 'planner'))
  with check (public.get_trip_role(trip_id) in ('organizer', 'planner'));

create policy "organizers and planners can delete itinerary items"
  on public.itinerary_items
  for delete
  using (public.get_trip_role(trip_id) in ('organizer', 'planner'));

-- NOTE:
-- The spec says members can read only invite codes they personally used to join,
-- but the schema does not include invite redemption tracking, so that policy
-- cannot be expressed exactly without an additional table or column.
