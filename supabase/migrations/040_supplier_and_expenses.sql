-- Migration 040: supplier field + basic Finance (income/expenses) ledger
--
-- Two small, concrete pieces from the feature-parity request that don't
-- need any third-party account to build:
--   1. "Товари → Постачальники" — a supplier name/contact on each product.
--   2. "Фінанси" — a simple manual expense ledger, sitting next to the
--      revenue already computed from `transactions`. Same owner/director-
--      only visibility rule as migration 039 (financial data isolation).

alter table public.inventory_items
  add column if not exists supplier_name  text,
  add column if not exists supplier_phone text,
  add column if not exists supplier_notes text;

create table if not exists public.expenses (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  category     text not null default 'other', -- rent, salary, delivery, ads, supplies, other
  description  text,
  amount       numeric(12,2) not null,
  currency     text not null default 'UAH',
  spent_at     date not null default current_date,
  created_by   uuid references public.employees(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_expenses_business_id on public.expenses(business_id, spent_at);

alter table public.expenses enable row level security;

-- Same rule as transactions/orders: only owner or director may read or
-- write the expense ledger — this is exactly the "фінанси" the owner
-- asked to keep private.
create policy "owner_director_expenses" on public.expenses
  for all using (public.is_owner_or_director(business_id))
  with check (public.is_owner_or_director(business_id));
