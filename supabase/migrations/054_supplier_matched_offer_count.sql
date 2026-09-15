-- Keep separate counts for matched catalog rows and supplier offers.
-- One supplier can publish several offers with the same SKU.
alter table public.supplier_feeds
  add column if not exists last_matched_offers_count integer not null default 0;
