-- Legacy supplier/import rows sometimes had a non-empty category but still
-- used the SKU (or an import placeholder) as the product name. They must not
-- appear in returns, transfers, stocktaking, barcode lookup, or delivery lists.
update public.inventory_items
set source = 'supplier',
    track_supplier = true
where source = 'site'
  and (
    name ilike 'import placeholder%'
    or (sku is not null and lower(trim(name)) = lower(trim(sku)))
    or name ~ '^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+([-_/][A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+)+$'
  );
