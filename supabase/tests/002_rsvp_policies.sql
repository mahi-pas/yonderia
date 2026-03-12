begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

create or replace function pg_temp.authenticate_as(uid uuid, user_email text)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.email', user_email, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', uid::text,
      'role', 'authenticated',
      'email', user_email
    )::text,
    true
  );
end;
$$;

create or replace function pg_temp.capture_sqlstate(sql_text text)
returns text
language plpgsql
as $$
begin
  execute sql_text;
  return '00000';
exception
  when others then
    return sqlstate;
end;
$$;

create or replace function pg_temp.exec_row_count(sql_text text)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  execute sql_text;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

select plan(13);

-- Clean and create test users (RSVP tests use 5xx and 6xx suffix IDs)
delete from public.event_rsvps
where itinerary_item_id in (
  select id from public.itinerary_items
  where trip_id in (
    'eeeeeeee-0000-0000-0000-000000000005',
    'ffffffff-0000-0000-0000-000000000006'
  )
);

delete from public.itinerary_items
where trip_id in (
  'eeeeeeee-0000-0000-0000-000000000005',
  'ffffffff-0000-0000-0000-000000000006'
);

delete from public.trip_participants
where trip_id in (
  'eeeeeeee-0000-0000-0000-000000000005',
  'ffffffff-0000-0000-0000-000000000006'
);

delete from public.trips
where id in (
  'eeeeeeee-0000-0000-0000-000000000005',
  'ffffffff-0000-0000-0000-000000000006'
);

delete from auth.users
where id in (
  '00000000-0000-0000-0000-0000000005a1',
  '00000000-0000-0000-0000-0000000005b2',
  '00000000-0000-0000-0000-0000000005c3'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000005a1',
  'authenticated',
  'authenticated',
  'rsvp_user_a@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"RSVP User A"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000005b2',
  'authenticated',
  'authenticated',
  'rsvp_user_b@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"RSVP User B"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000005c3',
  'authenticated',
  'authenticated',
  'rsvp_user_c@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"RSVP User C"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

set local role authenticated;

-- Trip 5: User A (organizer), User B (member). Trip 6: User C only (so C is not in trip 5).
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000005a1',
  'rsvp_user_a@yonderia.test'
);

insert into public.trips (
  id,
  name,
  description,
  start_date,
  end_date,
  created_by
)
values (
  'eeeeeeee-0000-0000-0000-000000000005',
  'RSVP Test Trip',
  'Trip for event RSVP policy tests.',
  date '2026-07-01',
  date '2026-07-05',
  '00000000-0000-0000-0000-0000000005a1'
);

insert into public.trip_participants (id, trip_id, user_id, role)
values
(
  'bbbbbbbb-0000-0000-0000-0000000005a1',
  'eeeeeeee-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-0000000005a1',
  'organizer'
),
(
  'bbbbbbbb-0000-0000-0000-0000000005b2',
  'eeeeeeee-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-0000000005b2',
  'member'
);

insert into public.itinerary_items (
  id,
  trip_id,
  item_type,
  title,
  day_date,
  created_by
)
values (
  'dddddddd-0000-0000-0000-0000000005e1',
  'eeeeeeee-0000-0000-0000-000000000005',
  'event',
  'RSVP Test Event',
  date '2026-07-02',
  '00000000-0000-0000-0000-0000000005a1'
);

-- Trip 6: only User C (for non-participant read test)
insert into public.trips (
  id,
  name,
  description,
  start_date,
  end_date,
  created_by
)
values (
  'ffffffff-0000-0000-0000-000000000006',
  'Other Trip',
  'Trip that User C is in; A and B are not participants.',
  date '2026-08-01',
  date '2026-08-05',
  '00000000-0000-0000-0000-0000000005c3'
);

insert into public.trip_participants (id, trip_id, user_id, role)
values (
  'bbbbbbbb-0000-0000-0000-0000000006c3',
  'ffffffff-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-0000000005c3',
  'organizer'
);

insert into public.itinerary_items (
  id,
  trip_id,
  item_type,
  title,
  day_date,
  created_by
)
values (
  'dddddddd-0000-0000-0000-0000000006e1',
  'ffffffff-0000-0000-0000-000000000006',
  'event',
  'Other Trip Event',
  date '2026-08-02',
  '00000000-0000-0000-0000-0000000005c3'
);

-- Participant can create their own RSVP
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000005a1',
  'rsvp_user_a@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    insert into public.event_rsvps (itinerary_item_id, user_id, status)
    values (
      'dddddddd-0000-0000-0000-0000000005e1',
      '00000000-0000-0000-0000-0000000005a1',
      'going'
    )
  $$),
  1::bigint,
  'Participant can create their own RSVP'
);

-- Participant CANNOT create an RSVP with someone else''s user_id
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000005a1',
  'rsvp_user_a@yonderia.test'
);

select ok(
  pg_temp.capture_sqlstate($$
    insert into public.event_rsvps (itinerary_item_id, user_id, status)
    values (
      'dddddddd-0000-0000-0000-0000000005e1',
      '00000000-0000-0000-0000-0000000005b2',
      'going'
    )
  $$) <> '00000',
  'Participant cannot create an RSVP with someone else''s user_id'
);

-- Participant can read all RSVPs for items in their trip
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000005b2',
  'rsvp_user_b@yonderia.test'
);

insert into public.event_rsvps (itinerary_item_id, user_id, status)
values (
  'dddddddd-0000-0000-0000-0000000005e1',
  '00000000-0000-0000-0000-0000000005b2',
  'interested'
);

select is(
  (select count(*) from public.event_rsvps where itinerary_item_id = 'dddddddd-0000-0000-0000-0000000005e1'),
  2::bigint,
  'Participant can read all RSVPs for items in their trip (sees own and user_a)'
);

-- Participant can update only their own RSVP
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000005b2',
  'rsvp_user_b@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    update public.event_rsvps
    set status = 'going'
    where itinerary_item_id = 'dddddddd-0000-0000-0000-0000000005e1'
      and user_id = '00000000-0000-0000-0000-0000000005b2'
  $$),
  1::bigint,
  'Participant can update their own RSVP'
);

select is(
  pg_temp.exec_row_count($$
    update public.event_rsvps
    set status = 'interested'
    where itinerary_item_id = 'dddddddd-0000-0000-0000-0000000005e1'
      and user_id = '00000000-0000-0000-0000-0000000005a1'
  $$),
  0::bigint,
  'Participant cannot update another participant''s RSVP'
);

-- Participant can delete only their own RSVP
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000005b2',
  'rsvp_user_b@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.event_rsvps
    where itinerary_item_id = 'dddddddd-0000-0000-0000-0000000005e1'
      and user_id = '00000000-0000-0000-0000-0000000005b2'
  $$),
  1::bigint,
  'Participant can delete their own RSVP'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.event_rsvps
    where itinerary_item_id = 'dddddddd-0000-0000-0000-0000000005e1'
      and user_id = '00000000-0000-0000-0000-0000000005a1'
  $$),
  0::bigint,
  'Participant cannot delete another participant''s RSVP'
);

-- Non-participant cannot read RSVPs for items in trips they are not in
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000005c3',
  'rsvp_user_c@yonderia.test'
);

select is(
  (select count(*) from public.event_rsvps where itinerary_item_id = 'dddddddd-0000-0000-0000-0000000005e1'),
  0::bigint,
  'Non-participant cannot read RSVPs for items in trips they are not in'
);

-- RSVP is deleted when the itinerary item is deleted (CASCADE)
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000005a1',
  'rsvp_user_a@yonderia.test'
);

insert into public.event_rsvps (itinerary_item_id, user_id, status)
values (
  'dddddddd-0000-0000-0000-0000000005e1',
  '00000000-0000-0000-0000-0000000005a1',
  'going'
);

select is(
  (select count(*) from public.event_rsvps where itinerary_item_id = 'dddddddd-0000-0000-0000-0000000005e1'),
  1::bigint,
  'One RSVP exists before deleting itinerary item'
);

delete from public.itinerary_items
where id = 'dddddddd-0000-0000-0000-0000000005e1';

select is(
  (select count(*) from public.event_rsvps where itinerary_item_id = 'dddddddd-0000-0000-0000-0000000005e1'),
  0::bigint,
  'RSVP is deleted when the itinerary item is deleted (CASCADE)'
);

-- Restore itinerary item for kick test
insert into public.itinerary_items (
  id,
  trip_id,
  item_type,
  title,
  day_date,
  created_by
)
values (
  'dddddddd-0000-0000-0000-0000000005e1',
  'eeeeeeee-0000-0000-0000-000000000005',
  'event',
  'RSVP Test Event',
  date '2026-07-02',
  '00000000-0000-0000-0000-0000000005a1'
);

insert into public.event_rsvps (itinerary_item_id, user_id, status)
values
(
  'dddddddd-0000-0000-0000-0000000005e1',
  '00000000-0000-0000-0000-0000000005a1',
  'going'
),
(
  'dddddddd-0000-0000-0000-0000000005e1',
  '00000000-0000-0000-0000-0000000005b2',
  'interested'
);

-- Kick user B from trip 5 → their RSVPs for trip 5 events are cleaned up (trigger)
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000005a1',
  'rsvp_user_a@yonderia.test'
);

select is(
  (select count(*) from public.event_rsvps where user_id = '00000000-0000-0000-0000-0000000005b2'),
  1::bigint,
  'User B has one RSVP before kick'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'eeeeeeee-0000-0000-0000-000000000005'
      and user_id = '00000000-0000-0000-0000-0000000005b2'
  $$),
  1::bigint,
  'Organizer can kick user B'
);

select is(
  (select count(*) from public.event_rsvps where user_id = '00000000-0000-0000-0000-0000000005b2'),
  0::bigint,
  'RSVP is deleted when the user is removed from the trip (kick cleans up RSVPs)'
);

select * from finish();
rollback;
