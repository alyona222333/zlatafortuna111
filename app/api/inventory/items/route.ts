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
  'source, external_id, product_url, image_url, description, long_description, site_regular_price, site_sale_price, ' +
  'site_short_description, site_attributes, long_description, is_archived'

export async function GET(req: NextRequest) {
  const access = await getWarehouseAccess()
  if (!access?.canRead) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const filter = sp.get('filter') ?? 'all'
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

  // «Перелік» — це тільки каталог, выгруженный с нашего сайта. Прайсы
  // поставщиков используются в отдельном разделе и не могут добавлять сюда
  // свои названия, цены или позиции.
  query = query.eq('source', 'site')

  if (filter === 'in_stock') query = query.gt('quantity', 0)
  if (filter === 'out_of_stock') query = query.lte('quantity', 0)

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

  return NextResponse.json({
    items: data ?? [],
    // Some Supabase/PostgREST configurations can return rows but omit the
    // exact count. Never report zero in that case: it hides pagination and
    // makes a populated warehouse look empty at the bottom of the screen.
    total: Math.max(count ?? 0, from + (data?.length ?? 0)),
    has_more: (data?.length ?? 0) === perPage,
    total_known: count != null,
    page,
    per_page: perPage,
    can_edit: access.canEditItems,
    can_delete: access.canManageFeeds,
  })
}
