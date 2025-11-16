alter table public.appointments
  add column if not exists visit_type text not null default 'new'
  check (visit_type in ('new', 'follow_up'));

create or replace function public.compute_appointment_visit_type()
returns trigger
language plpgsql
as $$
declare
  has_previous boolean;
begin
  select exists(
    select 1
    from public.appointments other
    where other.patient_id = new.patient_id
      and other.starts_at < new.starts_at
      and other.id <> new.id
  ) into has_previous;

  if has_previous then
    new.visit_type := 'follow_up';
  else
    new.visit_type := 'new';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_compute_visit_type on public.appointments;

create trigger appointments_compute_visit_type
before insert or update of patient_id, starts_at
on public.appointments
for each row
execute function public.compute_appointment_visit_type();

update public.appointments a
set visit_type = case
  when exists (
    select 1
    from public.appointments other
    where other.patient_id = a.patient_id
      and other.starts_at < a.starts_at
  ) then 'follow_up'
  else 'new'
end;
