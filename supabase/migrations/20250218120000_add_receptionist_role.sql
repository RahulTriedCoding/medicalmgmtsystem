-- Ensure receptionist role exists in the user_role enum
do $$
declare
  enum_exists boolean;
begin
  select exists (
    select 1
    from pg_type
    where typname = 'user_role'
  ) into enum_exists;

  if enum_exists then
    if not exists (
      select 1
      from pg_enum
      where enumtypid = 'user_role'::regtype
        and enumlabel = 'receptionist'
    ) then
      alter type user_role add value 'receptionist';
    end if;
  end if;
end
$$;
