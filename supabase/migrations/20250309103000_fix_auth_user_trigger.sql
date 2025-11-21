-- Robust upsert of app users on auth sign-up to avoid duplicate key errors
-- Handles:
--   - Existing row matching auth_user_id
--   - Existing row matching email (case-insensitive)
--   - Fresh insert
-- Uses coalesce(role, meta role, 'doctor') to avoid null role

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(new.email);
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'doctor');
  v_updated boolean := false;
begin
  -- 1) Insert a fresh row; ignore conflict so we can reconcile below
  begin
    insert into public.users (email, full_name, auth_user_id, role, is_active, deactivated_at)
    values (v_email, v_name, new.id, v_role, true, null)
    on conflict do nothing;
  exception
    when unique_violation then
      null;
  end;

  -- 2) Update by auth_user_id if present
  update public.users
    set email = v_email,
        full_name = v_name,
        role = coalesce(public.users.role, v_role),
        is_active = true,
        deactivated_at = null
  where auth_user_id = new.id;
  if found then
    v_updated := true;
  end if;

  -- 3) If not updated, sync by email (case-insensitive) and attach auth_user_id
  if not v_updated then
    update public.users
      set auth_user_id = new.id,
          full_name = v_name,
          role = coalesce(public.users.role, v_role),
          is_active = true,
          deactivated_at = null
    where lower(email) = v_email;
  end if;

  return new;
end;
$$;

drop trigger if exists handle_new_auth_user on auth.users;

create trigger handle_new_auth_user
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
