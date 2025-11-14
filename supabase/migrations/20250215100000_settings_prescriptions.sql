create table if not exists public.app_settings (
  singleton boolean primary key default true,
  clinic_name text not null,
  clinic_email text not null,
  clinic_phone text not null,
  clinic_address text not null,
  currency text not null,
  timezone text not null,
  default_appointment_duration integer not null default 30,
  enable_email_notifications boolean not null default true,
  enable_sms_notifications boolean not null default false,
  billing_notes text,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger app_settings_touch_updated_at
before update on public.app_settings
for each row execute function public.touch_updated_at();

alter table public.app_settings enable row level security;

create policy app_settings_select_policy
on public.app_settings
for select
using (public.current_staff_role() in ('admin','doctor','receptionist'));

create policy app_settings_write_policy
on public.app_settings
for all
using (public.current_staff_role() = 'admin')
with check (public.current_staff_role() = 'admin');

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create table if not exists public.prescription_lines (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  name text not null,
  dosage text not null,
  quantity numeric(12,2) not null default 0 check (quantity >= 0)
);

create index if not exists prescription_lines_prescription_idx on public.prescription_lines(prescription_id);

alter table public.prescriptions enable row level security;
alter table public.prescription_lines enable row level security;

create policy prescriptions_select_policy
on public.prescriptions
for select
using (public.current_staff_role() in ('admin','doctor','receptionist'));

create policy prescriptions_write_policy
on public.prescriptions
for all
using (public.current_staff_role() in ('admin','doctor'))
with check (public.current_staff_role() in ('admin','doctor'));

create policy prescription_lines_select_policy
on public.prescription_lines
for select
using (public.current_staff_role() in ('admin','doctor','receptionist'));

create policy prescription_lines_write_policy
on public.prescription_lines
for all
using (public.current_staff_role() in ('admin','doctor'))
with check (public.current_staff_role() in ('admin','doctor'));
