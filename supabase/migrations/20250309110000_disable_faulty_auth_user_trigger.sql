-- Safe no-op trigger to avoid blocking auth user creation due to app-side constraints

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Temporarily no-op to ensure auth user creation never fails
  return new;
exception
  when others then
    -- swallow any error to avoid blocking signups
    return new;
end;
$$;

drop trigger if exists handle_new_auth_user on auth.users;

create trigger handle_new_auth_user
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
