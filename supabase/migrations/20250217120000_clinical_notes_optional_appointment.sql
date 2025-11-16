alter table if exists public.clinical_notes
  alter column appointment_id drop not null;
