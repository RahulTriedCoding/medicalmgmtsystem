-- Upsert app users when a Supabase auth user is created to avoid duplicate key errors
-- Assumptions:
--   - public.users has unique index on lower(email) (users_email_lower_unique)
--   - auth_user_id should be kept in sync and never null for real users

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(new.email);
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', new.email);
begin
  insert into public.users (email, full_name, auth_user_id, role, is_active, deactivated_at)
  values (v_email, v_name, new.id, coalesce(new.raw_user_meta_data->>'role', 'doctor'), true, null)
  on conflict (email) do update
    set full_name = excluded.full_name,
        auth_user_id = excluded.auth_user_id,
        -- do not override role if already set; keep existing unless metadata provided
        role = coalesce(public.users.role, excluded.role),
        is_active = true,
        deactivated_at = null;
  return new;
end;
$$;

drop trigger if exists handle_new_auth_user on auth.users;

create trigger handle_new_auth_user
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
