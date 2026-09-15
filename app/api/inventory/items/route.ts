/**
 * GET /api/inventory/items — посторінковий список складу.
 *
 * Каталог сайту — це близько десяти тисяч позицій, тож сторінка «Склад»
 * не тягне все одразу в HTML, а ходить сюди за 50 рядками. Пошук і
 * фільтр наявності теж рахує Postgres, а не браузер: інакше менеджер на
 * телефоні чекав би кілька мегабайт заради одного артикула.
 *
 * Параметри:
 *   q        — пошук за назвою / артикулом / штрих-кодом
 *   filter   — all | in_stock | out_of_stock | unmatched | untracked | archived
 *   source   — all | site | manual
 *   page     — з 1
 *   per_page — до 200
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'

const COLUMNS =
  'id, name, sku, barcode, category, unit, quantity, low_stock_threshold, sell_price, ' +
  'source, external_id, product_url, image_url, description, site_regular_price, site_sale_price, ' +
  'site_short_description, site_attributes, long_description, dropship_price, track_supplier, is_archived, ' +
  'supplier_feed_id, supplier_offer_id, supplier_available, supplier_stock, ' +
  'supplier_price, supplier_retail_price, supplier_url, supplier_match_type, supplier_checked_at'

export async function GET(req: NextRequest) {
  const access = await getWarehouseAccess()
  if (!access?.canRead) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const filter = sp.get('filter') ?? 'all'
  const source = sp.get('source') ?? 'all'
  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1)
  const perPage = Math.min(200, Math.max(1, Number(sp.get('per_page') ?? 50) || 50))

  const supabase = await createClient()

  let query = supabase
    .from('inventory_items')
    .select(COLUMNS, { count: 'exact' })
    .eq('business_id', access.businessId)

  // «Архів» — єдиний фільтр, що показує прибрані товари. Решта переглядів
  // їх ховає, інакше прибирання зі складу виглядало б так, ніби нічого
  // не сталося.
  if (filter === 'archived') query = query.eq('is_archived', true)
  else query = query.eq('is_archived', false)

  if (source === 'site' || source === 'manual') query = query.eq('source', source)

  if (filter === 'in_stock') query = query.eq('supplier_available', true)
  if (filter === 'out_of_stock') query = query.eq('supplier_available', false)
  if (filter === 'unmatched') query = query.is('supplier_offer_id', null).eq('track_supplier', true)
  if (filter === 'untracked') query = query.eq('track_supplier', false)

  if (q) {
    // Екрануємо кому і дужки: у PostgREST .or() вони — роздільники, і
    // артикул на кшталт «345/72,S» інакше зламав би весь вираз.
    const safe = q.replace(/[,()]/g, ' ').trim()
    if (safe) {
      query = query.or(
        `name.ilike.%${safe}%,sku.ilike.%${safe}%,barcode.ilike.%${safe}%,external_id.eq.${safe}`,
      )
    }
  }

  const from = (page - 1) * perPage
  const { data, error, count } = await query
    .order('name')
    .range(from, from + perPage - 1)

  if (error) {
    console.error('[inventory/items]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: feeds } = await supabase
    .from('supplier_feeds')
    .select('id, name')
    .eq('business_id', access.businessId)

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    feeds: feeds ?? [],
    can_edit: access.canEditItems,
    can_delete: access.canManageFeeds,
  })
}
