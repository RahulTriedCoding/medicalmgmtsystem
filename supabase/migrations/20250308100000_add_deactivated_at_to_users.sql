alter table public.users
  add column if not exists deactivated_at timestamptz;

create index if not exists users_deactivated_at_idx
  on public.users (deactivated_at);
