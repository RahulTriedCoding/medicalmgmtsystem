create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present','absent','late','leave')),
  marked_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_attendance_staff_date_unique unique (staff_id, date)
);

create index if not exists staff_attendance_staff_idx on public.staff_attendance (staff_id);
create index if not exists staff_attendance_date_idx on public.staff_attendance (date);

create trigger staff_attendance_touch_updated_at
before update on public.staff_attendance
for each row execute function public.touch_updated_at();

alter table public.staff_attendance enable row level security;

create policy staff_attendance_select_policy
on public.staff_attendance
for select
using (
  public.current_staff_role() = 'admin'
  or staff_id = public.current_staff_id()
);

create policy staff_attendance_insert_policy
on public.staff_attendance
for insert
with check (public.current_staff_role() = 'admin');

create policy staff_attendance_update_policy
on public.staff_attendance
for update
using (public.current_staff_role() = 'admin')
with check (public.current_staff_role() = 'admin');

create policy staff_attendance_delete_policy
on public.staff_attendance
for delete
using (public.current_staff_role() = 'admin');
