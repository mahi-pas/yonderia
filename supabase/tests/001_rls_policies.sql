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

select plan(45);

delete from public.invite_codes
where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001';

delete from public.itinerary_items
where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001';

delete from public.trip_participants
where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001';

delete from public.trips
where id = 'aaaaaaaa-0000-0000-0000-000000000001';

delete from auth.users
where id in (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-0000000000d4'
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
  '00000000-0000-0000-0000-0000000000a1',
  'authenticated',
  'authenticated',
  'user_a_rls@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"User A"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000b2',
  'authenticated',
  'authenticated',
  'user_b_rls@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"User B"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000c3',
  'authenticated',
  'authenticated',
  'user_c_rls@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"User C"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000d4',
  'authenticated',
  'authenticated',
  'user_d_rls@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"User D"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

select is(
  (select count(*) from public.profiles where id in (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000b2',
    '00000000-0000-0000-0000-0000000000c3',
    '00000000-0000-0000-0000-0000000000d4'
  )),
  4::bigint,
  'handle_new_user created profiles rows for all test users'
);

set local role authenticated;

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000a1',
  'user_a_rls@yonderia.test'
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
  'aaaaaaaa-0000-0000-0000-000000000001',
  'RLS Test Trip',
  'Trip used by pgTAP policy tests.',
  date '2026-05-01',
  date '2026-05-05',
  '00000000-0000-0000-0000-0000000000a1'
);

select ok(
  public.is_trip_creator('aaaaaaaa-0000-0000-0000-000000000001'),
  'user_a created a trip'
);

insert into public.trip_participants (
  id,
  trip_id,
  user_id,
  role
)
values (
  'bbbbbbbb-0000-0000-0000-0000000000a1',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000a1',
  'organizer'
);

select is(
  (select count(*) from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1::bigint,
  'user_a can read their trip'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000b2',
  'user_b_rls@yonderia.test'
);

select is(
  (select count(*) from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0::bigint,
  'user_b cannot read the trip before joining'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000a1',
  'user_a_rls@yonderia.test'
);

insert into public.trip_participants (
  id,
  trip_id,
  user_id,
  role
)
values
(
  'bbbbbbbb-0000-0000-0000-0000000000b2',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000b2',
  'planner'
),
(
  'bbbbbbbb-0000-0000-0000-0000000000c3',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000c3',
  'member'
),
(
  'bbbbbbbb-0000-0000-0000-0000000000d4',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000d4',
  'member'
);

select ok(
  exists (
    select 1 from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000b2'
      and role = 'planner'
  ),
  'user_a added user_b as a planner'
);

select ok(
  exists (
    select 1 from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000c3'
      and role = 'member'
  ),
  'user_a added user_c as a member'
);

select ok(
  exists (
    select 1 from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000d4'
      and role = 'member'
  ),
  'user_a added user_d as a member'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000b2',
  'user_b_rls@yonderia.test'
);

select is(
  (select count(*) from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1::bigint,
  'user_b can read the trip after joining'
);

select is(
  pg_temp.exec_row_count($$
    update public.trips
    set name = 'planner edit attempt'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  $$),
  0::bigint,
  'user_b cannot update the trip'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trips
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  $$),
  0::bigint,
  'user_b cannot delete the trip'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000c3',
  'user_c_rls@yonderia.test'
);

select is(
  (select count(*) from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1::bigint,
  'user_c can read the trip after joining'
);

select is(
  pg_temp.exec_row_count($$
    update public.trips
    set name = 'member edit attempt'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  $$),
  0::bigint,
  'user_c cannot update the trip'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trips
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  $$),
  0::bigint,
  'user_c cannot delete the trip'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000b2',
  'user_b_rls@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    update public.trip_participants
    set nickname = 'Planner Bee',
        arrival_location = 'Kyoto Station'
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000b2'
  $$),
  1::bigint,
  'user_b can update their own participant row'
);

select is(
  (
    select nickname from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000b2'
  ),
  'Planner Bee',
  'user_b own participant update persisted'
);

select is(
  pg_temp.exec_row_count($$
    update public.trip_participants
    set nickname = 'Not Allowed'
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000c3'
  $$),
  0::bigint,
  'user_b cannot update user_c participant row'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000c3',
  'user_c_rls@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    update public.trip_participants
    set nickname = 'Member C'
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000c3'
  $$),
  1::bigint,
  'user_c can update their own participant row'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000a1',
  'user_a_rls@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    update public.trip_participants
    set role = 'planner'
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000d4'
  $$),
  1::bigint,
  'user_a can promote a participant role'
);

select is(
  (
    select role from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000d4'
  ),
  'planner',
  'user_a role update persisted'
);

select is(
  pg_temp.exec_row_count($$
    update public.trip_participants
    set nickname = 'Navigator Nick'
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000d4'
  $$),
  1::bigint,
  'user_a can update a participant nickname'
);

select is(
  pg_temp.exec_row_count($$
    update public.trip_participants
    set arrival_location = 'Not Allowed'
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000d4'
  $$),
  0::bigint,
  'user_a cannot update another participant travel details'
);

insert into public.invite_codes (
  id,
  trip_id,
  code,
  code_type,
  created_by
)
values
(
  'cccccccc-0000-0000-0000-0000000000a1',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'RLSJOIN001',
  'join',
  '00000000-0000-0000-0000-0000000000a1'
),
(
  'cccccccc-0000-0000-0000-0000000000a2',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'RLSPLAN001',
  'join_planner',
  '00000000-0000-0000-0000-0000000000a1'
),
(
  'cccccccc-0000-0000-0000-0000000000a3',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'RLSVIEW001',
  'view',
  '00000000-0000-0000-0000-0000000000a1'
);

select is(
  (
    select count(*) from public.invite_codes
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and created_by = '00000000-0000-0000-0000-0000000000a1'
  ),
  3::bigint,
  'user_a created invite codes of all three types'
);

select is(
  (
    select count(*) from public.invite_codes
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  3::bigint,
  'user_a can read all invite codes'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000b2',
  'user_b_rls@yonderia.test'
);

insert into public.invite_codes (
  id,
  trip_id,
  code,
  code_type,
  created_by
)
values (
  'cccccccc-0000-0000-0000-0000000000b1',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'RLSBPLAN01',
  'join',
  '00000000-0000-0000-0000-0000000000b2'
);

select is(
  (
    select count(*) from public.invite_codes
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and created_by = '00000000-0000-0000-0000-0000000000b2'
  ),
  1::bigint,
  'user_b can create invite codes as a planner'
);

select is(
  (
    select count(*) from public.invite_codes
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  4::bigint,
  'user_b can read invite codes as a planner'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000c3',
  'user_c_rls@yonderia.test'
);

select ok(
  pg_temp.capture_sqlstate($$
    insert into public.invite_codes (id, trip_id, code, code_type, created_by)
    values (
      'cccccccc-0000-0000-0000-0000000000c1',
      'aaaaaaaa-0000-0000-0000-000000000001',
      'RLSMEM001',
      'join',
      '00000000-0000-0000-0000-0000000000c3'
    )
  $$) <> '00000',
  'user_c cannot create invite codes as a member'
);

select is(
  (
    select count(*) from public.invite_codes
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'user_c cannot read invite codes they did not use'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000a1',
  'user_a_rls@yonderia.test'
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
  'dddddddd-0000-0000-0000-0000000000a1',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'event',
  'Organizer Created Item',
  date '2026-05-02',
  '00000000-0000-0000-0000-0000000000a1'
);

select is(
  (
    select count(*) from public.itinerary_items
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'user_a can create itinerary items'
);

select is(
  (
    select count(*) from public.itinerary_items
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'user_a can read itinerary items'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000b2',
  'user_b_rls@yonderia.test'
);

select is(
  (
    select count(*) from public.itinerary_items
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'user_b can read itinerary items'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000c3',
  'user_c_rls@yonderia.test'
);

select is(
  (
    select count(*) from public.itinerary_items
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'user_c can read itinerary items'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000b2',
  'user_b_rls@yonderia.test'
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
  'dddddddd-0000-0000-0000-0000000000b1',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'hotel',
  'Planner Created Item',
  date '2026-05-03',
  '00000000-0000-0000-0000-0000000000b2'
);

select is(
  (
    select count(*) from public.itinerary_items
    where id = 'dddddddd-0000-0000-0000-0000000000b1'
  ),
  1::bigint,
  'user_b can create itinerary items as a planner'
);

select is(
  pg_temp.exec_row_count($$
    update public.itinerary_items
    set title = 'Planner Updated Item'
    where id = 'dddddddd-0000-0000-0000-0000000000b1'
  $$),
  1::bigint,
  'user_b can update itinerary items as a planner'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.itinerary_items
    where id = 'dddddddd-0000-0000-0000-0000000000b1'
  $$),
  1::bigint,
  'user_b can delete itinerary items as a planner'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000c3',
  'user_c_rls@yonderia.test'
);

select ok(
  pg_temp.capture_sqlstate($$
    insert into public.itinerary_items (id, trip_id, item_type, title, day_date, created_by)
    values (
      'dddddddd-0000-0000-0000-0000000000c1',
      'aaaaaaaa-0000-0000-0000-000000000001',
      'event',
      'Member Created Item',
      date '2026-05-04',
      '00000000-0000-0000-0000-0000000000c3'
    )
  $$) <> '00000',
  'user_c cannot create itinerary items as a member'
);

select is(
  pg_temp.exec_row_count($$
    update public.itinerary_items
    set title = 'Member Edit Attempt'
    where id = 'dddddddd-0000-0000-0000-0000000000a1'
  $$),
  0::bigint,
  'user_c cannot update itinerary items as a member'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.itinerary_items
    where id = 'dddddddd-0000-0000-0000-0000000000a1'
  $$),
  0::bigint,
  'user_c cannot delete itinerary items as a member'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000c3',
  'user_c_rls@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000b2'
  $$),
  0::bigint,
  'user_c cannot kick user_b'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000b2',
  'user_b_rls@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000a1'
  $$),
  0::bigint,
  'user_b cannot kick user_a'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000d4'
  $$),
  0::bigint,
  'user_b cannot kick user_d'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000c3'
  $$),
  1::bigint,
  'user_b can kick user_c'
);

select is(
  (
    select count(*) from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000c3'
  ),
  0::bigint,
  'user_c participant row was deleted by a planner'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000000a1',
  'user_a_rls@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000a1'
  $$),
  0::bigint,
  'user_a cannot delete their own organizer row'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000d4'
  $$),
  1::bigint,
  'user_a can kick user_d'
);

select is(
  (
    select count(*) from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-0000000000d4'
  ),
  0::bigint,
  'user_d participant row was deleted'
);

select * from finish();
rollback;
