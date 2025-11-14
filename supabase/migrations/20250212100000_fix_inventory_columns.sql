-- Ensure inventory_items has all columns required by the application
alter table if exists public.inventory_items
  add column if not exists description text,
  add column if not exists unit text,
  add column if not exists low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.users(id) on delete set null;

-- Refresh updated_at automatically when records change
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'inventory_items_touch_updated_at'
  ) then
    create trigger inventory_items_touch_updated_at
    before update on public.inventory_items
    for each row execute function public.touch_updated_at();
  end if;
end;
$$;
