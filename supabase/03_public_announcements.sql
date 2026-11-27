begin;
create or replace function public.portal_public_announcements()
returns table(id text, title text, content text, priority text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, left(a.data->>'title', 180), left(a.data->>'content', 5000), a.data->>'priority', a.created_at
  from public.announcements a
  where a.data->'public' = 'true'::jsonb
  order by a.created_at desc, a.id desc
  limit 12
$$;
revoke all on function public.portal_public_announcements() from public;
grant execute on function public.portal_public_announcements() to anon, authenticated;
commit;
