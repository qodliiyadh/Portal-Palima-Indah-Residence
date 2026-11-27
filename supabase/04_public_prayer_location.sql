begin;
create or replace function public.portal_guard_prayer_location()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and (select public.portal_role()) is distinct from 'admin' then
    if tg_op = 'DELETE' then
      if old.data ? 'prayer_location' then raise exception 'Hanya admin dapat menghapus lokasi jadwal'; end if;
    elsif tg_op = 'INSERT' then
      if new.data ? 'prayer_location' then raise exception 'Hanya admin dapat menetapkan lokasi jadwal'; end if;
    elsif new.data->'prayer_location' is distinct from old.data->'prayer_location' then
      raise exception 'Hanya admin dapat mengubah lokasi jadwal';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists portal_guard_prayer_location on public.settings;
create trigger portal_guard_prayer_location before insert or update or delete on public.settings
for each row execute function public.portal_guard_prayer_location();

create or replace function public.portal_prayer_location()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('province', left(s.data->'prayer_location'->>'province',100), 'city', left(s.data->'prayer_location'->>'city',100))
  from public.settings s where s.id = 'app'
$$;
revoke all on function public.portal_prayer_location() from public;
grant execute on function public.portal_prayer_location() to anon, authenticated;
commit;
