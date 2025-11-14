create table if not exists public.staff_contacts (
  user_id uuid primary key references public.users(id) on delete cascade,
  phone text,
  pending boolean not null default false,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_contacts_touch_updated_at
before update on public.staff_contacts
for each row execute function public.touch_updated_at();

alter table public.staff_contacts enable row level security;

create policy staff_contacts_select_policy
on public.staff_contacts
for select
using (public.current_staff_role() = 'admin');

create policy staff_contacts_write_policy
on public.staff_contacts
for all
using (public.current_staff_role() = 'admin')
with check (public.current_staff_role() = 'admin');
