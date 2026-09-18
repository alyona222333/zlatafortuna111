-- Return audit trail and security alerts for e-commerce refunds.
create table if not exists public.return_security_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  item_id uuid references public.inventory_items(id) on delete set null,
  operation text not null default 'return',
  payment_method text,
  order_reference text,
  quantity numeric(12,3) not null,
  note text,
  risk_level text not null default 'normal' check (risk_level in ('normal','suspicious')),
  risk_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_return_security_events_business_created on public.return_security_events(business_id, created_at desc);
create index if not exists idx_return_security_events_risk on public.return_security_events(business_id, risk_level, created_at desc);
alter table public.return_security_events enable row level security;
drop policy if exists return_security_events_read on public.return_security_events;
create policy return_security_events_read on public.return_security_events for select using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists (select 1 from public.employees e where e.business_id = business_id and e.user_id = auth.uid() and e.is_active and e.role in ('director','security','hr'))
);
drop policy if exists return_security_events_insert on public.return_security_events;
create policy return_security_events_insert on public.return_security_events for insert with check (
  actor_id = auth.uid() and business_id in (select public.my_business_ids())
);
