create table if not exists public.product_sets (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.product_set_items (
  id uuid primary key default uuid_generate_v4(),
  set_id uuid not null references public.product_sets(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric(10,3) not null default 1,
  unique(set_id, item_id)
);
alter table public.product_sets enable row level security;
alter table public.product_set_items enable row level security;
create policy "tenant_access_product_sets" on public.product_sets for all using (business_id in (select public.my_business_ids()));
create policy "tenant_access_product_set_items" on public.product_set_items for all using (set_id in (select id from public.product_sets where business_id in (select public.my_business_ids())));
grant all on table public.product_sets, public.product_set_items to authenticated;
