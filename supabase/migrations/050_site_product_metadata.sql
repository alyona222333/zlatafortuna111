-- Keep the warehouse row faithful to the product exported from the site.
alter table public.inventory_items
  add column if not exists site_regular_price numeric(12,2),
  add column if not exists site_sale_price numeric(12,2),
  add column if not exists site_short_description text,
  add column if not exists site_attributes text;

comment on column public.inventory_items.product_url is 'Product URL from the site export';
comment on column public.inventory_items.site_regular_price is 'Regular price from the site export';
comment on column public.inventory_items.site_sale_price is 'Sale price from the site export';
comment on column public.inventory_items.site_short_description is 'Short product description from the site export';
comment on column public.inventory_items.site_attributes is 'Variation/product parameters from the site export';
