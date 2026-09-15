import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json()

  const { data: current } = await supabase.from('inventory_items').select('manual_overrides').eq('id', params.id).maybeSingle()
  const manualKeys = ['name', 'category', 'description', 'long_description', 'product_url', 'image_url', 'sell_price', 'dropship_price', 'site_regular_price', 'site_sale_price', 'site_short_description', 'site_attributes']
  const manualOverrides = { ...((current as { manual_overrides?: Record<string, boolean> } | null)?.manual_overrides ?? {}) }
  for (const key of manualKeys) if (Object.prototype.hasOwnProperty.call(body, key)) manualOverrides[key] = true

  const { data, error } = await supabase.from('inventory_items').update({
    name: body.name,
    sku: (body.sku as string) || null,
    category: (body.category as string) || null,
    unit: body.unit,
    low_stock_threshold: Number(body.low_stock_threshold) || 5,
    cost_price: body.cost_price ? Number(body.cost_price) : null,
    sell_price: body.sell_price ? Number(body.sell_price) : null,
    dropship_price: body.dropship_price ? Number(body.dropship_price) : null,
    description: body.description ?? null,
    long_description: body.long_description ?? null,
    product_url: body.product_url ?? null,
    image_url: body.image_url ?? null,
    site_regular_price: body.site_regular_price ? Number(body.site_regular_price) : null,
    site_sale_price: body.site_sale_price ? Number(body.site_sale_price) : null,
    site_short_description: body.site_short_description ?? null,
    site_attributes: body.site_attributes ?? null,
    manual_overrides: manualOverrides,
    supplier_name: (body.supplier_name as string) || null,
    supplier_phone: (body.supplier_phone as string) || null,
  } as never).eq('id', params.id).select().single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'sku_taken', message: 'An item with this SKU already exists.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
