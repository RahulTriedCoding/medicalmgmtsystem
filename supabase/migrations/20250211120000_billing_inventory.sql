-- Ensure UUID helpers are available
create extension if not exists "pgcrypto";

-- Helper functions reused by RLS policies.
create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Billing tables
create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  patient_id uuid not null references public.patients(id) on delete cascade,
  due_date date not null,
  status text not null check (status in ('pending','paid','overdue','partial')),
  notes text,
  total numeric(12,2) not null default 0,
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null
);

create table if not exists public.billing_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  method text,
  reference text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

-- Inventory adjustments log
create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  delta integer not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

-- Indexes for common lookups
create index if not exists billing_invoices_patient_id_idx on public.billing_invoices (patient_id);
create index if not exists billing_invoices_status_idx on public.billing_invoices (status);
create index if not exists billing_invoices_due_date_idx on public.billing_invoices (due_date);
create index if not exists billing_invoice_items_invoice_id_idx on public.billing_invoice_items (invoice_id);
create index if not exists billing_payments_invoice_id_idx on public.billing_payments (invoice_id);
create index if not exists billing_payments_paid_at_idx on public.billing_payments (paid_at);
create index if not exists inventory_adjustments_item_idx on public.inventory_adjustments (item_id);

-- Keep timestamps fresh
create trigger billing_invoices_touch_updated_at
before update on public.billing_invoices
for each row execute function public.touch_updated_at();

-- Enable RLS
alter table public.billing_invoices enable row level security;
alter table public.billing_invoice_items enable row level security;
alter table public.billing_payments enable row level security;
alter table public.inventory_adjustments enable row level security;

-- Billing policies (match API guard logic)
create policy billing_invoices_select_policy
on public.billing_invoices
for select
using (public.current_staff_role() in ('admin','doctor','receptionist'));

create policy billing_invoices_insert_policy
on public.billing_invoices
for insert
with check (public.current_staff_role() in ('admin','receptionist'));

create policy billing_invoices_update_policy
on public.billing_invoices
for update
using (public.current_staff_role() in ('admin','receptionist'))
with check (public.current_staff_role() in ('admin','receptionist'));

create policy billing_invoices_delete_policy
on public.billing_invoices
for delete
using (public.current_staff_role() in ('admin','receptionist'));

create policy billing_invoice_items_select_policy
on public.billing_invoice_items
for select
using (public.current_staff_role() in ('admin','doctor','receptionist'));

create policy billing_invoice_items_write_policy
on public.billing_invoice_items
for all
using (public.current_staff_role() in ('admin','receptionist'))
with check (public.current_staff_role() in ('admin','receptionist'));

create policy billing_payments_select_policy
on public.billing_payments
for select
using (public.current_staff_role() in ('admin','doctor','receptionist'));

create policy billing_payments_write_policy
on public.billing_payments
for all
using (public.current_staff_role() in ('admin','receptionist'))
with check (public.current_staff_role() in ('admin','receptionist'));

-- Inventory adjustment policies
create policy inventory_adjustments_select_policy
on public.inventory_adjustments
for select
using (public.current_staff_role() in ('admin','doctor','receptionist'));

create policy inventory_adjustments_write_policy
on public.inventory_adjustments
for all
using (public.current_staff_role() in ('admin','doctor','receptionist'))
with check (public.current_staff_role() in ('admin','doctor','receptionist'));
