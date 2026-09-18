import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'
import { normArticle } from '@/lib/supplier-feeds'

export async function GET(req: Request) {
  const access = await getWarehouseAccess()
  if (!access?.canRead) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const feedId = url.searchParams.get('feed_id')?.trim() ?? ''
  const supabase = await createClient()
  let query = supabase
    .from('supplier_offers')
    .select('id,feed_id,offer_id,vendor_code,barcode,name,price,old_price,retail_price,wholesale_price,available,stock_quantity,url,picture,short_description,description,fetched_at')
    .eq('business_id', access.businessId)
    .order('name')
    .limit(500)
  if (q) query = query.or(`vendor_code.ilike.%${q.replace(/[,()]/g, ' ') }%,name.ilike.%${q.replace(/[,()]/g, ' ') }%`)
  if (feedId) query = query.eq('feed_id', feedId)
  const { data: offers, error } = await query as any
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let totalsQuery = supabase.from('supplier_offers').select('id', { count: 'exact', head: true }).eq('business_id', access.businessId)
  if (feedId) totalsQuery = totalsQuery.eq('feed_id', feedId)
  const { count: totalOffers } = await totalsQuery
  const { data: items } = await supabase.from('inventory_items').select('sku,sku_norm').eq('business_id', access.businessId).eq('is_archived', false)
  const existing = new Set((items ?? []).map((i) => i.sku_norm).filter(Boolean))
  let importedQuery = supabase
    .from('inventory_items')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', access.businessId)
    .eq('is_archived', false)
    .not('supplier_offer_id', 'is', null)
  if (feedId) importedQuery = importedQuery.eq('supplier_feed_id', feedId)
  const { count: importedInCatalog } = await importedQuery
  const { data: feeds } = await supabase.from('supplier_feeds').select('id,name').eq('business_id', access.businessId)
  const feedNames = new Map((feeds ?? []).map((f) => [f.id, f.name]))
  const mapped = (offers ?? []).map((o: any) => ({ ...o, feed_name: feedNames.get(o.feed_id) ?? '—', already_imported: !!(o.vendor_code && existing.has(normArticle(o.vendor_code))) }))
  const importedCount = importedInCatalog ?? mapped.filter((o: any) => o.already_imported).length
  return NextResponse.json({
    offers: mapped,
    total_offers: totalOffers ?? 0,
    imported_in_catalog: importedCount,
    available_to_add: Math.max(0, (totalOffers ?? mapped.length) - importedCount),
  })
}

export async function POST(req: Request) {
  const access = await getWarehouseAccess()
  if (!access?.canEditItems) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!body?.offer_id && !body?.sku && !body?.skus) return NextResponse.json({ error: 'offer_or_sku_required' }, { status: 400 })
  const supabase = await createClient()
  let offer: any = null
  if (body.offer_id) {
    const result = await supabase.from('supplier_offers').select('*').eq('id', body.offer_id).eq('business_id', access.businessId).maybeSingle() as any
    offer = result.data
  } else {
    const requested = Array.isArray(body.skus) ? body.skus : String(body.skus ?? body.sku).split(/[\s,;]+/)
    const normalized = requested.map((sku: unknown) => normArticle(String(sku))).filter(Boolean)
    let offerQuery = supabase.from('supplier_offers').select('*').eq('business_id', access.businessId).in('vendor_code_norm', normalized).limit(100)
    if (body.feed_id) offerQuery = offerQuery.eq('feed_id', body.feed_id)
    const { data } = await offerQuery as any
    const existing = await supabase.from('inventory_items').select('sku_norm').eq('business_id', access.businessId).in('sku_norm', normalized) as any
    const taken = new Set((existing.data ?? []).map((row: any) => row.sku_norm))
    const offers = (data ?? []).filter((row: any) => !taken.has(row.vendor_code_norm))
    if (offers.length > 1) return NextResponse.json({ offers: offers.map((row: any) => ({ id: row.id, sku: row.vendor_code, name: row.name })) })
    offer = offers[0] ?? null
  }
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
    // Предложение из прайса не является товаром нашего сайта. Оно должно
    // оставаться в разделе поставщиков и не попадать в «Склад → Перелік».
    source: 'supplier', track_supplier: true,
    supplier_feed_id: offer.feed_id, supplier_offer_id: offer.offer_id,
    supplier_available: offer.available, supplier_stock: offer.stock_quantity,
    supplier_price: offer.wholesale_price ?? offer.price, supplier_retail_price: offer.retail_price ?? offer.old_price ?? offer.price,
    supplier_url: offer.url, supplier_match_type: 'sku', supplier_checked_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('inventory_items').insert(row as never).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
