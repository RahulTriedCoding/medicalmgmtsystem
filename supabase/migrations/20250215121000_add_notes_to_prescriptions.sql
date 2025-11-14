alter table public.prescriptions
  add column if not exists notes text;
