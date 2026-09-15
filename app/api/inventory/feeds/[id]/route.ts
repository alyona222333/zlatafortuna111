/**
 * PATCH  /api/inventory/feeds/[id] — увімкнути/вимкнути, перейменувати, змінити режим залишків
 * DELETE /api/inventory/feeds/[id] — прибрати посилання разом з його кешем оферів
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canManageFeeds) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 120)
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  if (typeof body.write_quantity === 'boolean') patch.write_quantity = body.write_quantity
  if (body.default_stock_when_available != null) {
    patch.default_stock_when_available = Number(body.default_stock_when_available) || 0
  }
  if (typeof body.auto_add_items === 'boolean') patch.auto_add_items = body.auto_add_items
  if (typeof body.notify_out_of_stock === 'boolean') patch.notify_out_of_stock = body.notify_out_of_stock
  if (body.default_markup_percent !== undefined) {
    patch.default_markup_percent =
      body.default_markup_percent === null || body.default_markup_percent === ''
        ? null
        : Number(body.default_markup_percent)
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_feeds')
    .update(patch as never)
    .eq('id', id)
    .eq('business_id', access.businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feed: data })
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canManageFeeds) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createClient()

  // Товари складу лишаються — зникає лише джерело наявності. Інакше
  // видалення одного постачальника винесло б половину каталогу сайту.
  await supabase
    .from('inventory_items')
    .update({
      supplier_feed_id: null,
      supplier_offer_id: null,
      supplier_available: null,
      supplier_stock: null,
      supplier_price: null,
      supplier_url: null,
      supplier_match_type: null,
    } as never)
    .eq('business_id', access.businessId)
    .eq('supplier_feed_id', id)

  const { error } = await supabase
    .from('supplier_feeds')
    .delete()
    .eq('id', id)
    .eq('business_id', access.businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
