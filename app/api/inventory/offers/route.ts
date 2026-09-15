import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'
import { normArticle } from '@/lib/supplier-feeds'

export async function GET(req: Request) {
  const access = await getWarehouseAccess()
  if (!access?.canRead) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const supabase = await createClient()
  let query = supabase
    .from('supplier_offers')
    .select('id,feed_id,offer_id,vendor_code,barcode,name,price,old_price,retail_price,wholesale_price,available,stock_quantity,url,picture,short_description,description,fetched_at')
    .eq('business_id', access.businessId)
    .order('name')
    .limit(500)
  if (q) query = query.or(`vendor_code.ilike.%${q.replace(/[,()]/g, ' ') }%,name.ilike.%${q.replace(/[,()]/g, ' ') }%`)
  const { data: offers, error } = await query as any
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: items } = await supabase.from('inventory_items').select('sku,sku_norm').eq('business_id', access.businessId)
  const existing = new Set((items ?? []).map((i) => i.sku_norm).filter(Boolean))
  const { data: feeds } = await supabase.from('supplier_feeds').select('id,name').eq('business_id', access.businessId)
  const feedNames = new Map((feeds ?? []).map((f) => [f.id, f.name]))
  return NextResponse.json({ offers: (offers ?? []).map((o: any) => ({ ...o, feed_name: feedNames.get(o.feed_id) ?? '—', already_imported: !!(o.vendor_code && existing.has(normArticle(o.vendor_code))) })) })
}

export async function POST(req: Request) {
  const access = await getWarehouseAccess()
  if (!access?.canEditItems) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!body?.offer_id) return NextResponse.json({ error: 'offer_required' }, { status: 400 })
  const supabase = await createClient()
  const { data: offer } = await supabase.from('supplier_offers').select('*').eq('id', body.offer_id).eq('business_id', access.businessId).maybeSingle() as any
  if (!offer || !offer.vendor_code) return NextResponse.json({ error: 'offer_not_found' }, { status: 404 })
  const normalized = normArticle(offer.vendor_code)
  if (!normalized) return NextResponse.json({ error: 'sku_required' }, { status: 400 })
  const { data: existing } = await supabase.from('inventory_items').select('id').eq('business_id', access.businessId).eq('sku_norm', normalized).maybeSingle()
  if (existing) return NextResponse.json({ error: 'sku_taken', id: existing.id }, { status: 409 })
  const row = {
    business_id: access.businessId,
    name: String(body.name ?? offer.name ?? offer.vendor_code).slice(0, 200),
    sku: offer.vendor_code,
    barcode: offer.barcode,
    category: body.category ?? null,
    unit: 'pcs', quantity: offer.stock_quantity ?? (offer.available ? 10 : 0),
    cost_price: offer.wholesale_price ?? offer.price,
    sell_price: body.sell_price ?? offer.retail_price ?? offer.old_price ?? offer.price,
    dropship_price: body.dropship_price ?? offer.retail_price ?? offer.price,
    description: body.description ?? offer.short_description,
    long_description: body.long_description ?? offer.description,
    image_url: body.image_url ?? offer.picture,
    product_url: body.product_url ?? offer.url,
    source: 'site', track_supplier: true,
    supplier_feed_id: offer.feed_id, supplier_offer_id: offer.offer_id,
    supplier_available: offer.available, supplier_stock: offer.stock_quantity,
    supplier_price: offer.wholesale_price ?? offer.price, supplier_retail_price: offer.retail_price ?? offer.old_price ?? offer.price,
    supplier_url: offer.url, supplier_match_type: 'sku', supplier_checked_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('inventory_items').insert(row as never).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
