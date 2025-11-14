alter table public.prescriptions
add column if not exists created_by uuid references public.users(id) on delete set null;
