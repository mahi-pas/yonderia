insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'trip-images',
    'trip-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'itinerary-images',
    'itinerary-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read managed image buckets"
  on storage.objects;

create policy "public can read managed image buckets"
  on storage.objects
  for select
  using (bucket_id in ('avatars', 'trip-images', 'itinerary-images'));

drop policy if exists "authenticated users can upload managed image buckets"
  on storage.objects;

create policy "authenticated users can upload managed image buckets"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id in ('avatars', 'trip-images', 'itinerary-images'));

drop policy if exists "authenticated users can update managed image buckets"
  on storage.objects;

create policy "authenticated users can update managed image buckets"
  on storage.objects
  for update
  to authenticated
  using (bucket_id in ('avatars', 'trip-images', 'itinerary-images'))
  with check (bucket_id in ('avatars', 'trip-images', 'itinerary-images'));

drop policy if exists "authenticated users can delete managed image buckets"
  on storage.objects;

create policy "authenticated users can delete managed image buckets"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id in ('avatars', 'trip-images', 'itinerary-images'));
