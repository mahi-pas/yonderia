-- Allow announcements to have content and/or gif_url (same as comments)
alter table public.event_comments
  drop constraint if exists event_comments_content_or_gif_check;

alter table public.event_comments
  add constraint event_comments_content_or_gif_check check (
    content is not null or gif_url is not null
  );
