-- Migration 038: Orders module (leads / e-commerce orders)
--
-- What this adds:
--   A dedicated pipeline for online orders/leads coming from a website
--   (WooCommerce or any storefront), phone calls, or social media — as
--   requested: "панель робоча де приходитимуть ліди та оформлюється
--   замовлення з новою поштою, укрпоштою, адресами".
--
-- This is separate from `clients` (a person) and `transactions` (a paid
-- in-person sale rung up at the register): an order can exist before
-- payment, needs a delivery address, and moves through a status pipeline
-- (new -> confirmed -> shipped -> done / cancelled).

create table if not exists public.orders (
  id                uuid primary key default uuid_generate_v4(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  client_id         uuid references public.clients(id) on delete set null,

  -- Who placed it, in case there's no matching CRM client yet
  customer_name     text not null,
  customer_phone    text,
  customer_email    text,

  -- Where it came from — powers the "lead source" reporting the person asked for
  source            text not null default 'manual', -- manual, website, woocommerce, phone, instagram, facebook, telegram

  -- What was ordered — kept as JSON so it doesn't require every store to
  -- already have every product in `inventory_items`
  items             jsonb not null default '[]'::jsonb, -- [{ name, qty, price }]
  total_amount      numeric(12,2) not null default 0,
  currency          text not null default 'UAH',

  -- Delivery
  delivery_method   text not null default 'pickup', -- pickup, nova_poshta, ukrposhta, courier
  delivery_city     text,
  delivery_branch   text,   -- Nova Poshta/Ukrposhta warehouse number, or courier address
  delivery_address  text,   -- full address for courier delivery
  ttn_number        text,   -- waybill/tracking number once created

  status            text not null default 'new', -- new, confirmed, packed, shipped, done, cancelled
  assigned_to       uuid references public.employees(id) on delete set null,
  notes             text,

  external_order_id text,  -- WooCommerce order ID etc., for de-duplication on webhook retries
  external_source    text, -- which system external_order_id belongs to (e.g. 'woocommerce')

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_orders_business_id on public.orders(business_id);
create index if not exists idx_orders_status on public.orders(business_id, status);
create index if not exists idx_orders_external on public.orders(external_source, external_order_id) where external_order_id is not null;

alter table public.orders enable row level security;

create policy "tenant_access_orders" on public.orders
  for all using (business_id in (select public.my_business_ids()));

-- Webhook secret + WooCommerce site URL live on businesses so each tenant
-- can have their own store connected.
alter table public.businesses
  add column if not exists woocommerce_url            text,
  add column if not exists woocommerce_webhook_secret  text,
  add column if not exists nova_poshta_api_key         text;
