-- Restore handle_new_auth_user with safe upsert that never blocks auth signup

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
begin
  -- Try update by auth_user_id
  update public.users
    set email = v_email,
        full_name = v_name,
        role = coalesce(public.users.role, v_role),
        is_active = true,
        deactivated_at = null
  where auth_user_id = new.id;
  if found then
    return new;
  end if;

  -- Try update by email (case-insensitive), attach auth_user_id
  update public.users
    set auth_user_id = new.id,
        full_name = v_name,
        role = coalesce(public.users.role, v_role),
        is_active = true,
        deactivated_at = null
  where lower(email) = v_email;
  if found then
    return new;
  end if;

  -- Insert fresh row; ignore conflicts to avoid blocking signups
  begin
    insert into public.users (email, full_name, auth_user_id, role, is_active, deactivated_at)
    values (v_email, v_name, new.id, v_role, true, null)
    on conflict do nothing;
  exception
    when others then
      -- swallow to avoid breaking auth signup
      null;
  end;

  return new;
end;
$$;

drop trigger if exists handle_new_auth_user on auth.users;
create trigger handle_new_auth_user
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
