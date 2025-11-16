create table if not exists public.note_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  created_by uuid references public.users(id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_templates_name_unique unique (name)
);

create trigger note_templates_touch_updated_at
before update on public.note_templates
for each row execute function public.touch_updated_at();

insert into public.note_templates (name, body, is_default)
values (
  'General Clinical Evaluation',
  'Past History:
- Diabetes: Yes/No
- Hypertension: Yes/No
- BP: ________

Surgical History:
- CVS/CNS: ________
- Other surgeries: ________

System Examination:
Respiratory System:
- ________

Abdominal:
- ________

CNS:
- ________

CVS:
- ________

Advice:
- Blood test
- MRI
- X-ray

Provisional Diagnosis:
- ________

Rx:
- ________',
  true
)
on conflict (name) do nothing;

alter table public.note_templates enable row level security;

create policy note_templates_select_policy
on public.note_templates
for select
using (public.current_staff_role() in ('admin', 'doctor'));

create policy note_templates_modify_policy
on public.note_templates
for all
using (public.current_staff_role() = 'admin')
with check (public.current_staff_role() = 'admin');
