alter table public.patients
  add column if not exists blood_group text,
  add column if not exists marital_status text,
  add column if not exists location text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists district text,
  add column if not exists relative_name text,
  add column if not exists relative_phone text,
  add column if not exists occupation text;
