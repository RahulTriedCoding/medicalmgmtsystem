-- Sync existing auth users into public.users and harden handle_new_auth_user
-- This resolves duplicate email/auth_user_id issues and keeps users active.

-- Backfill/link all existing auth users
with mapped as (
  select
    au.id as auth_id,
    lower(trim(au.email)) as email,
    coalesce(nullif(trim(au.raw_user_meta_data->>'full_name'), ''), au.email) as full_name,
    (case lower(coalesce(au.raw_user_meta_data->>'role', 'doctor'))
       when 'admin' then 'admin'
       when 'receptionist' then 'receptionist'
       else 'doctor'
     end)::user_role as role
  from auth.users au
)
insert into public.users (email, full_name, auth_user_id, role, is_active, deactivated_at)
select email, full_name, auth_id, role, true, null
from mapped
on conflict (email) do update
  set auth_user_id   = excluded.auth_user_id,
      full_name      = excluded.full_name,
      role           = coalesce(public.users.role, excluded.role),
      is_active      = true,
      deactivated_at = null;

-- Robust trigger for new auth signups; normalizes email and handles conflicts
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(new.email));
  v_name  text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), new.email);
  v_role  user_role := (
    case lower(coalesce(new.raw_user_meta_data->>'role', 'doctor'))
      when 'admin' then 'admin'::user_role
      when 'receptionist' then 'receptionist'::user_role
      else 'doctor'::user_role
    end
  );
begin
  insert into public.users (email, full_name, auth_user_id, role, is_active, deactivated_at)
  values (v_email, v_name, new.id, v_role, true, null)
  on conflict (email) do update
    set auth_user_id   = excluded.auth_user_id,
        full_name      = excluded.full_name,
        role           = coalesce(public.users.role, excluded.role),
        is_active      = true,
        deactivated_at = null;

  return new;
exception
  when others then
    raise warning '[auth] handle_new_auth_user failure: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists handle_new_auth_user on auth.users;
create trigger handle_new_auth_user
after insert on auth.users
for each row execute function public.handle_new_auth_user();
