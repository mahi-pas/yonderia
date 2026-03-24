create table public.notification_reads (
  user_id uuid references public.profiles(id) on delete cascade not null,
  notification_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create index idx_notification_reads_user_read_at
  on public.notification_reads(user_id, read_at desc);

alter table public.notification_reads enable row level security;

create policy "users can read own notification reads"
  on public.notification_reads
  for select
  using (auth.uid() = user_id);

create policy "users can insert own notification reads"
  on public.notification_reads
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update own notification reads"
  on public.notification_reads
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own notification reads"
  on public.notification_reads
  for delete
  using (auth.uid() = user_id);
