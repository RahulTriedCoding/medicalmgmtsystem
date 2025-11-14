alter table public.prescriptions
  add column if not exists patient_id uuid references public.patients(id) on delete cascade;
