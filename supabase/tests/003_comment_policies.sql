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

select plan(9);

-- Clean and create test data (comment tests use 7xx suffix IDs)
delete from public.event_comments
where itinerary_item_id in (
  select id from public.itinerary_items
  where trip_id in (
    '77777777-0000-0000-0000-000000000007',
    '88888888-0000-0000-0000-000000000008'
  )
);

delete from public.itinerary_items
where trip_id in (
  '77777777-0000-0000-0000-000000000007',
  '88888888-0000-0000-0000-000000000008'
);

delete from public.trip_participants
where trip_id in (
  '77777777-0000-0000-0000-000000000007',
  '88888888-0000-0000-0000-000000000008'
);

delete from public.trips
where id in (
  '77777777-0000-0000-0000-000000000007',
  '88888888-0000-0000-0000-000000000008'
);

delete from auth.users
where id in (
  '00000000-0000-0000-0000-0000000007a1',
  '00000000-0000-0000-0000-0000000007b2',
  '00000000-0000-0000-0000-0000000007c3',
  '00000000-0000-0000-0000-0000000007d4'
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
  '00000000-0000-0000-0000-0000000007a1',
  'authenticated',
  'authenticated',
  'comment_organizer@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Comment Organizer"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000007b2',
  'authenticated',
  'authenticated',
  'comment_member@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Comment Member"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000007c3',
  'authenticated',
  'authenticated',
  'comment_planner@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Comment Planner"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000007d4',
  'authenticated',
  'authenticated',
  'comment_other@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Other Trip User"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

set local role authenticated;

-- Trip 7: Organizer (7a1), Member (7b2), Planner (7c3). Trip 8: User 7d4 only.
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000007a1',
  'comment_organizer@yonderia.test'
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
  '77777777-0000-0000-0000-000000000007',
  'Comment Test Trip',
  'Trip for event comment policy tests.',
  date '2026-09-01',
  date '2026-09-05',
  '00000000-0000-0000-0000-0000000007a1'
);

insert into public.trip_participants (id, trip_id, user_id, role)
values
(
  'cccccccc-0000-0000-0000-0000000007a1',
  '77777777-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-0000000007a1',
  'organizer'
),
(
  'cccccccc-0000-0000-0000-0000000007b2',
  '77777777-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-0000000007b2',
  'member'
),
(
  'cccccccc-0000-0000-0000-0000000007c3',
  '77777777-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-0000000007c3',
  'planner'
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
  'eeeeeeee-0000-0000-0000-0000000007e1',
  '77777777-0000-0000-0000-000000000007',
  'event',
  'Comment Test Event',
  date '2026-09-02',
  '00000000-0000-0000-0000-0000000007a1'
);

-- Trip 8: only User 7d4 (for non-participant tests)
insert into public.trips (
  id,
  name,
  description,
  start_date,
  end_date,
  created_by
)
values (
  '88888888-0000-0000-0000-000000000008',
  'Other Comment Trip',
  'Trip that User 7d4 is in.',
  date '2026-10-01',
  date '2026-10-05',
  '00000000-0000-0000-0000-0000000007d4'
);

insert into public.trip_participants (id, trip_id, user_id, role)
values (
  'cccccccc-0000-0000-0000-0000000008d4',
  '88888888-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-0000000007d4',
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
  'eeeeeeee-0000-0000-0000-0000000008e1',
  '88888888-0000-0000-0000-000000000008',
  'event',
  'Other Trip Event',
  date '2026-10-02',
  '00000000-0000-0000-0000-0000000007d4'
);

-- Participant can create a comment on an event in their trip
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000007b2',
  'comment_member@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    insert into public.event_comments (itinerary_item_id, user_id, content)
    values (
      'eeeeeeee-0000-0000-0000-0000000007e1',
      '00000000-0000-0000-0000-0000000007b2',
      'Hello from member'
    )
  $$),
  1::bigint,
  'Participant can create a comment on an event in their trip'
);

-- Participant CANNOT create a comment on an event in a trip they''re not in
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000007d4',
  'comment_other@yonderia.test'
);

select ok(
  pg_temp.capture_sqlstate($$
    insert into public.event_comments (itinerary_item_id, user_id, content)
    values (
      'eeeeeeee-0000-0000-0000-0000000007e1',
      '00000000-0000-0000-0000-0000000007d4',
      'I am not in this trip'
    )
  $$) <> '00000',
  'Participant CANNOT create a comment on an event in a trip they are not in'
);

-- Participant can read all comments on events in their trip
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000007b2',
  'comment_member@yonderia.test'
);

select is(
  (select count(*) from public.event_comments where itinerary_item_id = 'eeeeeeee-0000-0000-0000-0000000007e1'),
  1::bigint,
  'Participant can read all comments on events in their trip'
);

-- Participant can delete their own comments
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000007b2',
  'comment_member@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.event_comments
    where itinerary_item_id = 'eeeeeeee-0000-0000-0000-0000000007e1'
      and user_id = '00000000-0000-0000-0000-0000000007b2'
  $$),
  1::bigint,
  'Participant can delete their own comments'
);

-- Re-add comment from member and one from organizer for next tests
insert into public.event_comments (itinerary_item_id, user_id, content)
values
(
  'eeeeeeee-0000-0000-0000-0000000007e1',
  '00000000-0000-0000-0000-0000000007b2',
  'Member comment'
),
(
  'eeeeeeee-0000-0000-0000-0000000007e1',
  '00000000-0000-0000-0000-0000000007a1',
  'Organizer comment'
);

-- Participant CANNOT delete other people''s comments
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000007b2',
  'comment_member@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.event_comments
    where itinerary_item_id = 'eeeeeeee-0000-0000-0000-0000000007e1'
      and user_id = '00000000-0000-0000-0000-0000000007a1'
  $$),
  0::bigint,
  'Participant CANNOT delete other people''s comments'
);

-- Organizer CAN delete any comment in their trip
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000007a1',
  'comment_organizer@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.event_comments
    where itinerary_item_id = 'eeeeeeee-0000-0000-0000-0000000007e1'
      and user_id = '00000000-0000-0000-0000-0000000007b2'
  $$),
  1::bigint,
  'Organizer CAN delete any comment in their trip'
);

-- Re-add member comment for planner test
insert into public.event_comments (itinerary_item_id, user_id, content)
values (
  'eeeeeeee-0000-0000-0000-0000000007e1',
  '00000000-0000-0000-0000-0000000007b2',
  'Member comment again'
);

-- Planner CANNOT delete other people''s comments (only organizer can)
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000007c3',
  'comment_planner@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.event_comments
    where itinerary_item_id = 'eeeeeeee-0000-0000-0000-0000000007e1'
      and user_id = '00000000-0000-0000-0000-0000000007b2'
  $$),
  0::bigint,
  'Planner CANNOT delete other people''s comments (only organizer can)'
);

-- Comment is deleted when the itinerary item is deleted (CASCADE)
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000007a1',
  'comment_organizer@yonderia.test'
);

select is(
  (select count(*) from public.event_comments where itinerary_item_id = 'eeeeeeee-0000-0000-0000-0000000007e1'),
  2::bigint,
  'Two comments exist before deleting itinerary item'
);

delete from public.itinerary_items
where id = 'eeeeeeee-0000-0000-0000-0000000007e1';

select is(
  (select count(*) from public.event_comments where itinerary_item_id = 'eeeeeeee-0000-0000-0000-0000000007e1'),
  0::bigint,
  'Comment is deleted when the itinerary item is deleted (CASCADE)'
);

-- Comment requires at least content OR gif_url (CHECK constraint)
select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000007a1',
  'comment_organizer@yonderia.test'
);

-- Restore itinerary item for CHECK test
insert into public.itinerary_items (
  id,
  trip_id,
  item_type,
  title,
  day_date,
  created_by
)
values (
  'eeeeeeee-0000-0000-0000-0000000007e1',
  '77777777-0000-0000-0000-000000000007',
  'event',
  'Comment Test Event',
  date '2026-09-02',
  '00000000-0000-0000-0000-0000000007a1'
);

select ok(
  pg_temp.capture_sqlstate($$
    insert into public.event_comments (itinerary_item_id, user_id)
    values (
      'eeeeeeee-0000-0000-0000-0000000007e1',
      '00000000-0000-0000-0000-0000000007a1'
    )
  $$) <> '00000',
  'Comment requires at least content OR gif_url (CHECK constraint)'
);

select * from finish();
rollback;
