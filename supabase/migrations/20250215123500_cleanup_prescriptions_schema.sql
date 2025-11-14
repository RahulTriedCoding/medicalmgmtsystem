do $$
declare
  col record;
begin
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prescriptions'
      and column_name not in ('id','patient_id','doctor_id','notes','created_at','created_by')
  loop
    execute format('alter table public.prescriptions drop column if exists %I cascade', col.column_name);
  end loop;
end $$;
