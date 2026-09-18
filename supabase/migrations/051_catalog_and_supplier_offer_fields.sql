-- Catalog fields used for round-trip WooCommerce CSV export.
alter table public.inventory_items
  add column if not exists long_description text,
  add column if not exists dropship_price numeric(12,2),
  add column if not exists supplier_retail_price numeric(12,2),
  add column if not exists manual_overrides jsonb not null default '{}'::jsonb;

alter table public.supplier_offers
  add column if not exists retail_price numeric(12,2),
  add column if not exists wholesale_price numeric(12,2),
  add column if not exists short_description text,
  add column if not exists description text;

comment on column public.inventory_items.long_description is 'Long product description from the site export';
comment on column public.inventory_items.dropship_price is 'Wholesale/drop-ship selling price';
comment on column public.supplier_offers.retail_price is 'Supplier recommended retail price';
comment on column public.supplier_offers.wholesale_price is 'Supplier wholesale price';

create index if not exists idx_supplier_offers_business_vendor_norm
  on public.supplier_offers(business_id, vendor_code_norm);

-- Supplier files populate offers and availability; they must not create catalog rows automatically.
update public.supplier_feeds set auto_add_items = false where auto_add_items = true;
