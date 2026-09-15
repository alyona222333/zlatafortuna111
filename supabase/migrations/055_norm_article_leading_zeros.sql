-- norm_article() у Postgres мав розійтись з normArticle() у TS
-- (lib/supplier-feeds.ts): бракувало літери Ѕ→S і провідні нулі не
-- прибирались. Через це чисто числові артикули на кшталт сайтового
-- "00926" ніколи не збігались з "926" у прайсі постачальника, хоча
-- обидва — той самий товар.

create or replace function public.norm_article(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        translate(
          upper(coalesce(p, '')),
          'АВЕКМНОРСТУХІЇЅ',   -- кирилиця
          'ABEKMHOPCTYXIIS'    -- візуально тотожна латиниця
        ),
        '[^A-Z0-9]', '', 'g'
      ),
      '^0+(?=[0-9])', ''       -- провідні нулі в чисто числовому артикулі
    ),
    ''
  )
$$;

-- Перерахувати sku_norm/vendor_code_norm по всій базі під нову функцію —
-- інакше старі значення так і лишаться зі старими нулями до наступного
-- update, і звірка мовчки продовжить хибити для вже завантажених рядків.
update public.inventory_items
   set sku_norm = public.norm_article(sku)
 where sku is not null;

update public.supplier_offers
   set vendor_code_norm = public.norm_article(vendor_code)
 where vendor_code is not null;
