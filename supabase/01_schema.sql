begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'warga' check (role in ('warga', 'pengurus', 'admin')),
  address text not null default '',
  phone text not null default '',
  ktp text not null default '',
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.portal_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid();
$$;
revoke all on function public.portal_role() from public, anon;
grant execute on function public.portal_role() to authenticated;

create function public.portal_new_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null then
    insert into public.profiles (id, email, name)
    values (new.id, new.email, coalesce(nullif(left(new.raw_user_meta_data->>'name', 150), ''), split_part(new.email, '@', 1)));
  end if;
  return new;
end;
$$;
revoke all on function public.portal_new_profile() from public, anon, authenticated;
create trigger portal_new_profile after insert on auth.users
for each row execute function public.portal_new_profile();

insert into public.profiles (id, email, name)
select id, email, coalesce(nullif(left(raw_user_meta_data->>'name', 150), ''), split_part(email, '@', 1))
from auth.users where email is not null on conflict (id) do nothing;

create function public.portal_sync_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;
revoke all on function public.portal_sync_email() from public, anon, authenticated;
create trigger portal_sync_email after update of email on auth.users
for each row when (old.email is distinct from new.email) execute function public.portal_sync_email();

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select, delete on public.profiles to authenticated;
grant update (name, role, address, phone, ktp, verified) on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or (select public.portal_role()) in ('admin', 'pengurus')
);
create policy profile_edit on public.profiles for update to authenticated using (
  (select public.portal_role()) = 'admin' and (role <> 'admin' or id = (select auth.uid()))
  or (select public.portal_role()) = 'pengurus' and (role = 'warga' or id = (select auth.uid()))
) with check (
  (select public.portal_role()) = 'admin' and (role <> 'admin' or id = (select auth.uid()))
  or (select public.portal_role()) = 'pengurus' and (role = 'warga' or id = (select auth.uid()))
);
create policy profile_delete on public.profiles for delete to authenticated using (
  id <> (select auth.uid()) and (
    (select public.portal_role()) = 'admin' and role in ('pengurus', 'warga')
    or (select public.portal_role()) = 'pengurus' and role = 'warga'
  )
);

create function public.portal_guard_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and old.role is distinct from new.role
     and (public.portal_role() is distinct from 'admin' or old.role = 'admin' or new.role = 'admin') then
    raise exception 'Perubahan peran tidak diizinkan' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.portal_guard_profile() from public, anon, authenticated;
create trigger portal_guard_profile before update on public.profiles
for each row execute function public.portal_guard_profile();

-- Flexible document fields stay separate from authoritative ownership and IDs.
do $$
declare t text;
begin
  foreach t in array array['residents','bills','payments','complaints','letters','transactions','announcements','schedules','ronda','logs','settings'] loop
    execute format('create table public.%I (
      id text primary key check (length(id) between 1 and 128),
      user_id uuid,
      created_at timestamptz not null default now(),
      data jsonb not null default ''{}''::jsonb check (jsonb_typeof(data) = ''object''
        and not (data ?| array[''id'', ''user_id'', ''created_at'', ''__proto__'']))
    )', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    if t in ('bills', 'payments', 'letters', 'complaints') then
      execute format('create index on public.%I (user_id)', t);
      execute format('alter table public.%I alter column user_id set not null', t);
      execute format('create policy owner_read on public.%I for select to authenticated using (
        (select public.portal_role()) in (''admin'', ''pengurus'') or
        ((select public.portal_role()) is not null and user_id = (select auth.uid())))', t);
    elsif t in ('transactions','announcements','schedules','ronda','settings') then
      execute format('create policy member_read on public.%I for select to authenticated using ((select public.portal_role()) is not null)', t);
    else
      execute format('create policy staff_read on public.%I for select to authenticated using ((select public.portal_role()) in (''admin'', ''pengurus''))', t);
    end if;
    if t <> 'logs' then
      execute format('grant insert (id, user_id, data), update (data, user_id), delete on public.%I to authenticated', t);
      execute format('create policy staff_insert on public.%I for insert to authenticated with check ((select public.portal_role()) in (''admin'', ''pengurus''))', t);
      execute format('create policy staff_update on public.%I for update to authenticated using ((select public.portal_role()) in (''admin'', ''pengurus'')) with check ((select public.portal_role()) in (''admin'', ''pengurus''))', t);
      execute format('create policy staff_delete on public.%I for delete to authenticated using ((select public.portal_role()) in (''admin'', ''pengurus''))', t);
    end if;
  end loop;
end;
$$;

create policy submit_own_complaint on public.complaints for insert to authenticated with check (
  (select public.portal_role()) = 'warga' and user_id = (select auth.uid()) and data->>'status' = 'pending'
);
create policy submit_own_letter on public.letters for insert to authenticated with check (
  (select public.portal_role()) = 'warga' and user_id = (select auth.uid()) and data->>'status' = 'pending'
);
do $$
declare t text;
begin
  foreach t in array array['complaints','letters'] loop
    execute format('create policy edit_own_pending on public.%I for update to authenticated using ((select public.portal_role()) = ''warga'' and user_id = (select auth.uid()) and data->>''status'' = ''pending'') with check (user_id = (select auth.uid()) and data->>''status'' = ''pending'')',t);
    execute format('create policy withdraw_own_pending on public.%I for delete to authenticated using ((select public.portal_role()) = ''warga'' and user_id = (select auth.uid()) and data->>''status'' = ''pending'')',t);
  end loop;
end;
$$;
create unique index ronda_one_override_per_date on public.ronda ((data->>'date')) where data ? 'date';

create policy pay_own_bill on public.bills for update to authenticated using (
  (select public.portal_role()) = 'warga' and user_id = (select auth.uid()) and data->>'status' = 'pending'
) with check (user_id = (select auth.uid()) and data->>'status' = 'paid');

create function public.portal_guard_document() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.role = 'warga' then
    if tg_table_name = 'bills' then
      if new.user_id is distinct from old.user_id
         or (new.data - array['status', 'proof', 'note', 'paid_at']) is distinct from
            (old.data - array['status', 'proof', 'note', 'paid_at']) then
        raise exception 'Hanya data pembayaran yang dapat diubah' using errcode = '42501';
      end if;
      new.data := new.data || jsonb_build_object('paid_at', now());
    elsif tg_table_name in ('complaints', 'letters') then
      new.data := new.data - array['response', 'reviewed_at', 'approved_at', 'letter_number', 'number']
        || jsonb_build_object('user_name', actor.name, 'phone', actor.phone);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.portal_guard_document() from public, anon, authenticated;
create trigger bill_guard before update on public.bills for each row execute function public.portal_guard_document();
create trigger complaint_guard before insert or update on public.complaints for each row execute function public.portal_guard_document();
create trigger letter_guard before insert or update on public.letters for each row execute function public.portal_guard_document();

-- Logs are append-only activity notes. The server sets the author and timestamp.
create function public.portal_add_log(p_id text, p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare actor public.profiles%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid();
  if not found then raise exception 'Profil tidak aktif' using errcode = '42501'; end if;
  insert into public.logs (id, user_id, data) values (p_id, actor.id, jsonb_build_object(
    'action', left(p_data->>'action', 150), 'detail', left(p_data->>'detail', 2000), 'user', actor.name, 'time', now()));
end;
$$;
revoke all on function public.portal_add_log(text, jsonb) from public, anon;
grant execute on function public.portal_add_log(text, jsonb) to authenticated;

alter table public.settings add constraint no_browser_secrets check (
  not (data ?| array['wa_api_key','sb_key','service_role_key','supabase_service_role_key'])
  and coalesce(data->>'key', '') not in ('wa_api_key','sb_key','service_role_key','supabase_service_role_key')
);

commit;
