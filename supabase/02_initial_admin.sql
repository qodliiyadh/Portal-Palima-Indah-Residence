-- After creating and confirming the initial user in Supabase Authentication > Users,
-- replace the placeholder with that user's UUID. Run only in the SQL Editor.
do $$
declare
  initial_admin_id uuid := '00000000-0000-0000-0000-000000000000';
begin
  if initial_admin_id = '00000000-0000-0000-0000-000000000000' then
    raise notice 'Set initial_admin_id to the UUID of a confirmed Auth user before running this script.';
    return;
  end if;
  update public.profiles as p set role = 'admin', verified = true
  from auth.users as u
  where p.id = initial_admin_id and u.id = p.id and u.email_confirmed_at is not null;
  if not found then raise exception 'No profile found for the specified confirmed Auth user'; end if;
end;
$$;
