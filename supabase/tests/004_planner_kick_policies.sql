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

select plan(17);

delete from public.trip_participants
where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004';

delete from public.trips
where id = 'aaaaaaaa-0000-0000-0000-000000000004';

delete from auth.users
where id in (
  '00000000-0000-0000-0000-0000000004a1',
  '00000000-0000-0000-0000-0000000004b2',
  '00000000-0000-0000-0000-0000000004c3',
  '00000000-0000-0000-0000-0000000004d4',
  '00000000-0000-0000-0000-0000000004e5',
  '00000000-0000-0000-0000-0000000004f6'
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
  '00000000-0000-0000-0000-0000000004a1',
  'authenticated',
  'authenticated',
  'kick_org_004@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Kick Organizer"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000004b2',
  'authenticated',
  'authenticated',
  'kick_planner_a_004@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Kick Planner A"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000004c3',
  'authenticated',
  'authenticated',
  'kick_planner_b_004@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Kick Planner B"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000004d4',
  'authenticated',
  'authenticated',
  'kick_member_a_004@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Kick Member A"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000004e5',
  'authenticated',
  'authenticated',
  'kick_member_b_004@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Kick Member B"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000004f6',
  'authenticated',
  'authenticated',
  'kick_member_c_004@yonderia.test',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Kick Member C"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

select is(
  (select count(*) from public.profiles where id in (
    '00000000-0000-0000-0000-0000000004a1',
    '00000000-0000-0000-0000-0000000004b2',
    '00000000-0000-0000-0000-0000000004c3',
    '00000000-0000-0000-0000-0000000004d4',
    '00000000-0000-0000-0000-0000000004e5',
    '00000000-0000-0000-0000-0000000004f6'
  )),
  6::bigint,
  'handle_new_user created profiles rows for planner kick policy users'
);

set local role authenticated;

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000004a1',
  'kick_org_004@yonderia.test'
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
  'aaaaaaaa-0000-0000-0000-000000000004',
  'Planner Kick Policy Trip',
  'Trip used by planner kick pgTAP tests.',
  date '2026-06-01',
  date '2026-06-05',
  '00000000-0000-0000-0000-0000000004a1'
);

insert into public.trip_participants (
  id,
  trip_id,
  user_id,
  role
)
values
(
  'bbbbbbbb-0000-0000-0000-0000000004a1',
  'aaaaaaaa-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-0000000004a1',
  'organizer'
),
(
  'bbbbbbbb-0000-0000-0000-0000000004b2',
  'aaaaaaaa-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-0000000004b2',
  'planner'
),
(
  'bbbbbbbb-0000-0000-0000-0000000004c3',
  'aaaaaaaa-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-0000000004c3',
  'planner'
),
(
  'bbbbbbbb-0000-0000-0000-0000000004d4',
  'aaaaaaaa-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-0000000004d4',
  'member'
),
(
  'bbbbbbbb-0000-0000-0000-0000000004e5',
  'aaaaaaaa-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-0000000004e5',
  'member'
),
(
  'bbbbbbbb-0000-0000-0000-0000000004f6',
  'aaaaaaaa-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-0000000004f6',
  'member'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004e5'
  $$),
  1::bigint,
  'organizer can delete a member participant row'
);

select is(
  (
    select count(*) from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004e5'
  ),
  0::bigint,
  'organizer member delete removed the participant row'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004c3'
  $$),
  1::bigint,
  'organizer can delete a planner participant row'
);

select is(
  (
    select count(*) from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004c3'
  ),
  0::bigint,
  'organizer planner delete removed the participant row'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004a1'
  $$),
  0::bigint,
  'organizer cannot delete their own participant row'
);

select is(
  (
    select count(*) from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004a1'
  ),
  1::bigint,
  'organizer participant row still exists after self delete attempt'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000004b2',
  'kick_planner_a_004@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004d4'
  $$),
  1::bigint,
  'planner can delete a member participant row'
);

select is(
  (
    select count(*) from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004d4'
  ),
  0::bigint,
  'planner member delete removed the participant row'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004a1'
  $$),
  0::bigint,
  'planner cannot delete the organizer participant row'
);

select is(
  (
    select count(*) from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004a1'
  ),
  1::bigint,
  'organizer participant row still exists after planner delete attempt'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004b2'
  $$),
  0::bigint,
  'planner cannot delete another planner participant row'
);

select is(
  (
    select count(*) from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004b2'
  ),
  1::bigint,
  'planner participant row still exists after planner delete attempt'
);

select pg_temp.authenticate_as(
  '00000000-0000-0000-0000-0000000004f6',
  'kick_member_c_004@yonderia.test'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004a1'
  $$),
  0::bigint,
  'member cannot delete the organizer participant row'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004b2'
  $$),
  0::bigint,
  'member cannot delete a planner participant row'
);

select is(
  pg_temp.exec_row_count($$
    delete from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004f6'
  $$),
  0::bigint,
  'member cannot delete their own participant row'
);

select is(
  (
    select count(*) from public.trip_participants
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000004'
      and user_id = '00000000-0000-0000-0000-0000000004f6'
  ),
  1::bigint,
  'member participant row still exists after all member delete attempts'
);

select * from finish();
rollback;
