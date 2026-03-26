-- Device tokens for push notifications (FCM / APNs)
create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A user should only have one entry per device token
  unique (user_id, device_token)
);

-- Index for looking up tokens by user (used when sending pushes)
create index if not exists idx_device_tokens_user_id on device_tokens(user_id);

-- RLS: users can only manage their own device tokens
alter table device_tokens enable row level security;

create policy "Users can view their own device tokens"
  on device_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert their own device tokens"
  on device_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own device tokens"
  on device_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own device tokens"
  on device_tokens for delete
  using (auth.uid() = user_id);
