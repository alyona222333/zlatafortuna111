-- Rows created from supplier offers by the old implementation were marked as
-- source='site'. They have code-like names, no site category, and must not be
-- shown in the site's catalog warehouse.
update public.inventory_items
set source = 'supplier',
    track_supplier = true
where source = 'site'
  and category is null
  and (
    name ilike 'import placeholder%'
    or name ~ '^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+([-_/][A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+)+$'
    or (sku is not null and lower(trim(name)) = lower(trim(sku)))
  );

comment on column public.inventory_items.source is
  'site = imported from the store catalog; manual = internal item; supplier = supplier offer, excluded from the site catalog';
