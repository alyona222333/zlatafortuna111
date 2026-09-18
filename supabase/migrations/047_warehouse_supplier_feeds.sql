-- Migration 047: «Склад» — товари з нашого сайту + наявність з прайсів постачальників
--
-- Задача власника дослівно:
--   «в файлі — товари, які вивантажені у нас на сайті, а в посиланнях — ці ж
--    товари від наших постачальників; у розділі Склад мають бути ВСІ товари
--    зі списку сайту, а наявність обовʼязково має братись з посилань, але не
--    весь товар постачальника, а саме те, що вивантажено у нас на сайті.
--    Також щоб можна було додати або прибрати товари.»
--
-- Отже:
--   * `inventory_items` лишається ЄДИНИМ списком складу. Рядок зʼявляється там
--     тільки якщо товар є на сайті (імпорт WooCommerce CSV, source='site')
--     або якщо його додали руками (source='manual'). Прайс постачальника
--     НІКОЛИ не створює нових рядків — він лише проставляє наявність.
--   * `supplier_feeds`  — самі посилання (XML/YML прайси постачальників).
--   * `supplier_offers` — кеш усіх пропозицій з цих прайсів. Потрібен, щоб
--     звести артикул сайту з артикулом постачальника і щоб «Склад» відкривався
--     миттєво, без походу в чужий XML на кожен рендер.
--   * нові колонки на `inventory_items` — результат звірки (наявність, ціна,
--     хто постачальник, коли перевіряли).
--
-- Доступ: власник + director + менеджери з продажів (див. lib/permissions.ts).
-- Закупівельні ціни постачальника — фінансові дані, тому їх читає лише
-- owner/director (політика нижче), рівно як у міграції 039.

-- ============================================================
-- 1. Прайси постачальників (посилання)
-- ============================================================
create table if not exists public.supplier_feeds (
  id                uuid primary key default uuid_generate_v4(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  name              text not null,
  url               text not null,
  -- 'yml' покриває і Rozetka XML, і products_feed.xml, і content/export —
  -- це все той самий yml_catalog/offers. Залишено полем на майбутнє (csv тощо).
  format            text not null default 'yml',
  is_active         boolean not null default true,
  -- Чи можна перезаписувати `quantity` складу залишком постачальника.
  -- Якщо постачальник віддає лише available="true/false" без числа —
  -- пишемо 0/`default_stock_when_available`.
  write_quantity    boolean not null default true,
  default_stock_when_available numeric(10,3) not null default 10,
  -- Діагностика останньої синхронізації (видно в UI /inventory/suppliers)
  last_synced_at    timestamptz,
  last_status       text,           -- 'ok' | 'error'
  last_error        text,
  last_offers_count integer not null default 0,
  last_matched_count integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists idx_supplier_feeds_business_url
  on public.supplier_feeds(business_id, url);

-- ============================================================
-- 2. Кеш пропозицій постачальника
-- ============================================================
create table if not exists public.supplier_offers (
  id             uuid primary key default uuid_generate_v4(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  feed_id        uuid not null references public.supplier_feeds(id) on delete cascade,
  offer_id       text not null,            -- <offer id="...">
  vendor_code    text,                     -- <vendorCode> — головний ключ звірки з SKU сайту
  -- Нормалізований vendor_code (верхній регістр, без пробілів/дефісів, кирилиця
  -- М/А/В/С/Е/Р/О/Х/К/Т/Н замінена на латиницю). Постачальники масово плутають
  -- «М2-1/2» кирилицею і «M2-1/2» латиницею — без цього збіг губиться.
  vendor_code_norm text,
  barcode        text,
  name           text,
  name_norm      text,                     -- lower(trim(name)) — запасний ключ звірки
  price          numeric(12,2),
  old_price      numeric(12,2),
  currency       text,
  available      boolean not null default false,
  stock_quantity numeric(10,3),            -- якщо постачальник віддає число
  url            text,
  picture        text,
  vendor         text,
  fetched_at     timestamptz not null default now()
);

create unique index if not exists idx_supplier_offers_feed_offer
  on public.supplier_offers(feed_id, offer_id);
create index if not exists idx_supplier_offers_vendor_code_norm
  on public.supplier_offers(business_id, vendor_code_norm);
create index if not exists idx_supplier_offers_name_norm
  on public.supplier_offers(business_id, name_norm);
create index if not exists idx_supplier_offers_business_feed
  on public.supplier_offers(business_id, feed_id);

-- ============================================================
-- 3. Склад: звідки товар і що показала звірка з прайсом
-- ============================================================
alter table public.inventory_items
  -- 'site'   — вивантажений на нашому сайті (імпорт WooCommerce CSV)
  -- 'manual' — доданий руками через «Додати товар»
  add column if not exists source                text not null default 'manual',
  add column if not exists external_id           text,        -- WooCommerce product ID
  add column if not exists product_url           text,
  add column if not exists image_url             text,
  -- Нормалізований артикул нашого сайту — дзеркало supplier_offers.vendor_code_norm
  add column if not exists sku_norm              text,
  -- Результат останньої звірки з прайсами
  add column if not exists supplier_feed_id      uuid references public.supplier_feeds(id) on delete set null,
  add column if not exists supplier_offer_id     text,
  add column if not exists supplier_available    boolean,
  add column if not exists supplier_stock        numeric(10,3),
  add column if not exists supplier_price        numeric(12,2),
  add column if not exists supplier_url          text,
  add column if not exists supplier_match_type   text,        -- 'sku' | 'barcode' | 'name' | null
  add column if not exists supplier_checked_at   timestamptz,
  -- Знято з відстеження: товар лишається на складі, але синк його не чіпає.
  -- Це «прибрати товар» без видалення історії — див. вимогу «додати або прибрати».
  add column if not exists track_supplier        boolean not null default true,
  add column if not exists is_archived           boolean not null default false;

create index if not exists idx_inventory_items_sku_norm
  on public.inventory_items(business_id, sku_norm);
create index if not exists idx_inventory_items_source
  on public.inventory_items(business_id, source);
create index if not exists idx_inventory_items_external
  on public.inventory_items(business_id, external_id);

-- ============================================================
-- 4. Налаштування складу (одна строка на бізнес)
-- ============================================================
create table if not exists public.warehouse_settings (
  business_id                  uuid primary key references public.businesses(id) on delete cascade,
  -- Головний перемикач: «наявність береться з прайсів постачальників».
  sync_availability            boolean not null default true,
  -- Що робити з товаром сайту, якого НЕМАЄ в жодному прайсі:
  -- 'unknown' — лишити «—» (за замовчуванням, нічого не вигадуємо)
  -- 'zero'    — вважати, що немає в наявності
  missing_offer_policy         text not null default 'unknown',
  auto_sync_minutes            integer not null default 60,
  updated_at                   timestamptz not null default now()
);

-- ============================================================
-- 5. Нормалізація артикулів — та сама логіка, що і в lib/supplier-feeds.ts
-- ============================================================
create or replace function public.norm_article(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    regexp_replace(
      translate(
        upper(coalesce(p, '')),
        'АВЕКМНОРСТУХІЇ',   -- кирилиця
        'ABEKMHOPCTYXII'    -- візуально тотожна латиниця
      ),
      '[^A-Z0-9]', '', 'g'
    ),
    ''
  )
$$;

-- Тримаємо sku_norm актуальним автоматично, щоб звірка ніколи не
-- залежала від того, чи не забув про це якийсь один код-шлях.
create or replace function public.set_inventory_sku_norm()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.sku_norm = public.norm_article(new.sku);
  return new;
end;
$$;

drop trigger if exists trg_inventory_sku_norm on public.inventory_items;
create trigger trg_inventory_sku_norm
  before insert or update of sku on public.inventory_items
  for each row execute function public.set_inventory_sku_norm();

update public.inventory_items
   set sku_norm = public.norm_article(sku)
 where sku is not null and sku_norm is null;

create or replace function public.set_supplier_offer_norms()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.vendor_code_norm = public.norm_article(new.vendor_code);
  new.name_norm = nullif(lower(btrim(coalesce(new.name, ''))), '');
  return new;
end;
$$;

drop trigger if exists trg_supplier_offer_norms on public.supplier_offers;
create trigger trg_supplier_offer_norms
  before insert or update on public.supplier_offers
  for each row execute function public.set_supplier_offer_norms();

drop trigger if exists trg_supplier_feeds_updated_at on public.supplier_feeds;
create trigger trg_supplier_feeds_updated_at
  before update on public.supplier_feeds
  for each row execute function public.set_updated_at();

-- ============================================================
-- 6. GRANTS + RLS
-- ============================================================
grant all on table public.supplier_feeds      to anon, authenticated;
grant all on table public.supplier_offers     to anon, authenticated;
grant all on table public.warehouse_settings  to anon, authenticated;
grant execute on function public.norm_article(text) to authenticated;

alter table public.supplier_feeds     enable row level security;
alter table public.supplier_offers    enable row level security;
alter table public.warehouse_settings enable row level security;

-- Читати прайси може будь-який співробітник тенанта: менеджеру з продажів
-- потрібно бачити наявність. Редагувати самі посилання — лише owner/director,
-- бо підміна URL прайсу = підміна цін і залишків усього складу.
drop policy if exists "tenant_read_supplier_feeds" on public.supplier_feeds;
create policy "tenant_read_supplier_feeds" on public.supplier_feeds
  for select using (business_id in (select public.my_business_ids()));

drop policy if exists "owner_director_write_supplier_feeds" on public.supplier_feeds;
create policy "owner_director_write_supplier_feeds" on public.supplier_feeds
  for all using (public.is_owner_or_director(business_id))
  with check (public.is_owner_or_director(business_id));

drop policy if exists "tenant_read_supplier_offers" on public.supplier_offers;
create policy "tenant_read_supplier_offers" on public.supplier_offers
  for select using (business_id in (select public.my_business_ids()));

-- Пише в кеш тільки синхронізація (service role, обходить RLS). Для
-- authenticated лишаємо запис у межах тенанта, щоб ручний «Оновити зараз»
-- працював і без service-role ключа.
drop policy if exists "tenant_write_supplier_offers" on public.supplier_offers;
create policy "tenant_write_supplier_offers" on public.supplier_offers
  for all using (business_id in (select public.my_business_ids()))
  with check (business_id in (select public.my_business_ids()));

drop policy if exists "tenant_read_warehouse_settings" on public.warehouse_settings;
create policy "tenant_read_warehouse_settings" on public.warehouse_settings
  for select using (business_id in (select public.my_business_ids()));

drop policy if exists "owner_director_write_warehouse_settings" on public.warehouse_settings;
create policy "owner_director_write_warehouse_settings" on public.warehouse_settings
  for all using (public.is_owner_or_director(business_id))
  with check (public.is_owner_or_director(business_id));

-- ============================================================
-- 7. Зведення для сторінки «Склад»
-- ============================================================
-- Скільки товарів сайту знайшлось у прайсах, скільки реально в наявності.
drop view if exists public.warehouse_overview;
create view public.warehouse_overview
with (security_invoker = true) as
  select
    i.business_id,
    count(*)                                              as total_items,
    count(*) filter (where i.source = 'site')              as site_items,
    count(*) filter (where i.supplier_offer_id is not null) as matched_items,
    count(*) filter (where i.supplier_available is true)    as in_stock_items,
    count(*) filter (where i.supplier_available is false)   as out_of_stock_items,
    count(*) filter (where i.track_supplier and i.supplier_offer_id is null) as unmatched_items,
    max(i.supplier_checked_at)                             as last_checked_at
  from public.inventory_items i
  where i.is_archived = false
  group by i.business_id;

grant select on public.warehouse_overview to authenticated;
