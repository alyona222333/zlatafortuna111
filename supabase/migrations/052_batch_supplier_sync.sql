-- Batch supplier synchronization. The server validates tenant ownership and updates
-- existing inventory rows in one database call; it never inserts catalog rows.
create or replace function public.sync_inventory_supplier_batch(
  p_business_id uuid,
  p_updates jsonb,
  p_clear_ids uuid[],
  p_missing_supplier_available boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer := 0;
  cleared integer := 0;
begin
  if not (p_business_id = any (array(select public.my_business_ids()))) then
    raise exception 'business_access_denied';
  end if;

  update public.inventory_items i
  set supplier_feed_id = x.supplier_feed_id,
      supplier_offer_id = x.supplier_offer_id,
      supplier_available = x.supplier_available,
      supplier_stock = x.supplier_stock,
      supplier_price = x.supplier_price,
      supplier_retail_price = x.supplier_retail_price,
      supplier_url = x.supplier_url,
      supplier_match_type = x.supplier_match_type,
      supplier_checked_at = x.supplier_checked_at,
      quantity = case when x.write_quantity then x.quantity else i.quantity end
  from jsonb_to_recordset(coalesce(p_updates, '[]'::jsonb)) as x(
    item_id uuid,
    supplier_feed_id uuid,
    supplier_offer_id text,
    supplier_available boolean,
    supplier_stock numeric,
    supplier_price numeric,
    supplier_retail_price numeric,
    supplier_url text,
    supplier_match_type text,
    supplier_checked_at timestamptz,
    write_quantity boolean,
    quantity numeric
  )
  where i.id = x.item_id and i.business_id = p_business_id;
  get diagnostics changed = row_count;

  if coalesce(array_length(p_clear_ids, 1), 0) > 0 then
    update public.inventory_items
    set supplier_feed_id = null,
        supplier_offer_id = null,
        supplier_stock = null,
        supplier_price = null,
        supplier_retail_price = null,
        supplier_url = null,
        supplier_match_type = null,
        supplier_available = case when p_missing_supplier_available then false else null end,
        supplier_checked_at = now()
    where business_id = p_business_id and id = any(p_clear_ids);
    get diagnostics cleared = row_count;
    changed := changed + cleared;
  end if;

  return changed;
end;
$$;

revoke all on function public.sync_inventory_supplier_batch(uuid, jsonb, uuid[], boolean) from public;
grant execute on function public.sync_inventory_supplier_batch(uuid, jsonb, uuid[], boolean) to authenticated;
