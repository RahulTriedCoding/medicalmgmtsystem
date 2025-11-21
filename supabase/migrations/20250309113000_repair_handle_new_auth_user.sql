-- Repair handle_new_auth_user to safely upsert without blocking auth signups

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
  -- First attempt: insert and ignore conflicts on existing constraints
  begin
    insert into public.users (email, full_name, auth_user_id, role, is_active, deactivated_at)
    values (v_email, v_name, new.id, v_role, true, null)
    on conflict (auth_user_id) do nothing;
  exception
    when others then null;
  end;

  -- Ensure linkage by auth_user_id if row already existed
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

  -- Otherwise link by email (case-insensitive) and attach auth_user_id, ignore conflicts
  begin
    update public.users
      set auth_user_id = new.id,
          full_name = v_name,
          role = coalesce(public.users.role, v_role),
          is_active = true,
          deactivated_at = null
    where lower(email) = v_email;
  exception
    when others then null;
  end;

  return new;
end;
$$;

drop trigger if exists handle_new_auth_user on auth.users;

create trigger handle_new_auth_user
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
