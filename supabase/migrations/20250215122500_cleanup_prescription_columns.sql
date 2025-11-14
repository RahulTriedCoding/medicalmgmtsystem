alter table public.prescriptions
  drop column if exists encounter_id cascade;

alter table public.prescriptions
  drop column if exists drug_name cascade;

alter table public.prescriptions
  drop column if exists medication cascade;

alter table public.prescriptions
  drop column if exists dosage cascade;

alter table public.prescriptions
  drop column if exists quantity cascade;
