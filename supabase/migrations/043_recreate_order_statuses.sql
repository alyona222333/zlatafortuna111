-- Migration 043: recreate order_statuses
--
-- This table (added in 042) was dropped by an unrelated migration run
-- from a different session against the same database (its own migration
-- history didn't know about 042, so its schema diff treated this table as
-- extraneous and removed it). Recreating it here, idempotently, with the
-- same shape and default seed as before.

create table if not exists public.order_statuses (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  key         text not null,
  label       text not null,
  color       text not null default '#94a3b8',
  sort_order  integer not null default 0,
  is_final    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (business_id, key)
);

alter table public.order_statuses enable row level security;

drop policy if exists "tenant_access_order_statuses" on public.order_statuses;
create policy "tenant_access_order_statuses" on public.order_statuses
  for all using (business_id in (select public.my_business_ids()));

insert into public.order_statuses (business_id, key, label, color, sort_order, is_final)
select b.id, s.key, s.label, s.color, s.sort_order, s.is_final
from public.businesses b
cross join (values
  ('new',       'Нове',          '#94a3b8', 0, false),
  ('confirmed', 'Підтверджено',  '#3b82f6', 1, false),
  ('packed',    'Зібрано',       '#8b5cf6', 2, false),
  ('shipped',   'Відправлено',   '#f59e0b', 3, false),
  ('done',      'Виконано',      '#16a34a', 4, true),
  ('cancelled', 'Скасовано',     '#ef4444', 5, true)
) as s(key, label, color, sort_order, is_final)
on conflict (business_id, key) do nothing;
