-- Migration 048: розділ «Постачальники» — файли, авто-додавання товарів,
--                 сповіщення про закінчення товару у постачальника
--
-- Що змінюється проти 047:
--
--  1. Джерелом прайсу може бути не лише посилання, а й завантажений файл
--     (XML/YML або CSV). Тому `supplier_feeds.url` більше не обовʼязковий,
--     зʼявляється `source_kind`.
--
--  2. Прайс може сам додавати свої товари на склад (`auto_add_items`).
--     У 047 це було заборонено навмисно: склад мав повторювати сайт.
--     Тепер це перемикач на кожного постачальника — «новий постачальник,
--     завантажили файл, товари самі стали на склад». Товари, створені так,
--     позначені `source = 'supplier'`, тож їх видно окремо від тих, що
--     прийшли з сайту, і можна відфільтрувати чи прибрати одним рухом.
--
--  3. `stock_alerts` — журнал подій наявності. Коли товар, який у нас є,
--     закінчився у постачальника, синхронізація пише сюди рядок, і
--     керівник бачить це одразу, не переглядаючи весь склад.

-- ============================================================
-- 1. Прайс з файлу
-- ============================================================
alter table public.supplier_feeds
  add column if not exists source_kind   text not null default 'url',  -- 'url' | 'file'
  add column if not exists file_name     text,
  add column if not exists auto_add_items boolean not null default false,
  add column if not exists notify_out_of_stock boolean not null default true,
  add column if not exists default_markup_percent numeric(6,2);

alter table public.supplier_feeds alter column url drop not null;

-- Унікальність по URL має діяти лише для посилань: у файлових прайсів
-- url порожній, і кілька NULL-ів індекс і так пропустить, але явний
-- частковий індекс чесніше описує намір.
drop index if exists public.idx_supplier_feeds_business_url;
create unique index if not exists idx_supplier_feeds_business_url
  on public.supplier_feeds(business_id, url)
  where url is not null;

-- ============================================================
-- 2. Журнал подій наявності
-- ============================================================
create table if not exists public.stock_alerts (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  item_id      uuid references public.inventory_items(id) on delete cascade,
  feed_id      uuid references public.supplier_feeds(id) on delete set null,
  -- 'out_of_stock'  — був у наявності, зник;
  -- 'back_in_stock' — зʼявився знову;
  -- 'dropped'       — постачальник взагалі прибрав позицію зі свого прайсу.
  kind         text not null,
  item_name    text,
  sku          text,
  supplier_name text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_stock_alerts_business
  on public.stock_alerts(business_id, is_read, created_at desc);
create index if not exists idx_stock_alerts_item
  on public.stock_alerts(item_id, created_at desc);

-- Той самий товар не має плодити однакову подію щогодини: одне
-- непрочитане сповіщення на товар і тип — далі воно просто лишається
-- непрочитаним, поки керівник його не закриє.
create unique index if not exists idx_stock_alerts_unread_unique
  on public.stock_alerts(item_id, kind)
  where is_read = false;

-- ============================================================
-- 3. Доступ
-- ============================================================
grant all on table public.stock_alerts to anon, authenticated;
alter table public.stock_alerts enable row level security;

-- Розділ «Постачальники» — рівень керівника: там закупівельні ціни,
-- посилання на прайси і умови роботи. Тому журнал подій теж читає
-- лише owner/director, на відміну від самої наявності у «Складі»,
-- яку бачать і менеджери.
drop policy if exists "owner_director_stock_alerts" on public.stock_alerts;
create policy "owner_director_stock_alerts" on public.stock_alerts
  for all using (public.is_owner_or_director(business_id))
  with check (public.is_owner_or_director(business_id));

-- ============================================================
-- 4. Зведення по постачальниках
-- ============================================================
drop view if exists public.supplier_overview;
create view public.supplier_overview
with (security_invoker = true) as
  select
    f.id                                   as feed_id,
    f.business_id,
    f.name,
    f.source_kind,
    count(i.id)                            as linked_items,
    count(i.id) filter (where i.supplier_available is true)  as in_stock_items,
    count(i.id) filter (where i.supplier_available is false) as out_of_stock_items
  from public.supplier_feeds f
  left join public.inventory_items i
    on i.supplier_feed_id = f.id and i.is_archived = false
  group by f.id, f.business_id, f.name, f.source_kind;

grant select on public.supplier_overview to authenticated;
