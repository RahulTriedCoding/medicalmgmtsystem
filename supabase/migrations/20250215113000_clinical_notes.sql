create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.users(id) on delete restrict,
  note_text text not null,
  template_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clinical_notes_touch_updated_at
before update on public.clinical_notes
for each row execute function public.touch_updated_at();

create index if not exists clinical_notes_appointment_idx on public.clinical_notes (appointment_id);
create index if not exists clinical_notes_patient_idx on public.clinical_notes (patient_id);
create index if not exists clinical_notes_doctor_idx on public.clinical_notes (doctor_id);
create index if not exists clinical_notes_created_idx on public.clinical_notes (created_at desc);

alter table public.clinical_notes enable row level security;

create policy clinical_notes_select_policy
on public.clinical_notes
for select
using (
  public.current_staff_role() = 'admin'
  or (
    public.current_staff_role() = 'doctor'
    and doctor_id = public.current_staff_id()
  )
);

create policy clinical_notes_write_policy
on public.clinical_notes
for all
using (
  public.current_staff_role() = 'admin'
  or (
    public.current_staff_role() = 'doctor'
    and doctor_id = public.current_staff_id()
  )
)
with check (
  public.current_staff_role() = 'admin'
  or (
    public.current_staff_role() = 'doctor'
    and doctor_id = public.current_staff_id()
  )
);
