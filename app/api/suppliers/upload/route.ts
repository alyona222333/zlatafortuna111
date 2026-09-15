/**
 * POST /api/suppliers/upload — завантажити файл прайсу.
 *
 * Приймає multipart/form-data:
 *   file        — XML/YML (те саме, що віддають посилання) або CSV/TSV прайс
 *   name        — назва постачальника (для нового)
 *   feed_id     — оновити вже наявного постачальника замість створення
 *   auto_add    — 'true': товари з файлу самі стають на склад
 *   markup      — націнка у відсотках для авто-доданих товарів
 *
 * Навіщо окремо від посилань: не кожен постачальник має XML-вивантаження.
 * Багато хто присилає прайс файлом раз на кілька днів — і цього достатньо,
 * щоб вести наявність, якщо в файлі є артикул.
 *
 * Розділ доступний лише керівнику: тут закупівельні ціни й умови роботи.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'
import { parseYmlFeed, type ParsedOffer } from '@/lib/supplier-feeds'
import { syncWarehouse } from '@/lib/warehouse-sync'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const CHUNK = 500

/* ---------------- CSV ---------------- */

function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = {
    ',': (firstLine.match(/,/g) ?? []).length,
    ';': (firstLine.match(/;/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ','
}

function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === delim) { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

const ALIASES: Record<string, string[]> = {
  sku: ['sku', 'артикул', 'артикул товара', 'артикул товару', 'код', 'код товара', 'код товару', 'vendorcode', 'code'],
  name: ['name', 'название', 'назва', 'наименование', 'найменування', 'товар', 'product'],
  price: ['price', 'цена', 'ціна', 'цена опт', 'опт', 'закупка', 'закупівельна'],
  retail_price: ['retail price', 'роздріб', 'ррц', 'rrp', 'recommended retail price'],
  wholesale_price: ['wholesale price', 'оптова ціна', 'ціна опт', 'wholesale'],
  stock: ['stock', 'остаток', 'залишок', 'количество', 'кількість', 'qty', 'quantity'],
  available: ['available', 'наличие', 'наявність', 'в наличии', 'в наявності', 'статус'],
  barcode: ['barcode', 'штрихкод', 'штрих-код', 'ean'],
}

const TRUE_WORDS = new Set([
  'true', '1', 'yes', 'y', '+', 'в наличии', 'в наявності', 'есть', 'є',
  'в наявності', 'in stock', 'available', 'да', 'так',
])

function num(v: string | undefined): number | null {
  if (!v) return null
  const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseCsvPrice(text: string): { offers: ParsedOffer[]; skipped: number } {
  const firstLine = text.slice(0, text.indexOf('\n') + 1 || 500)
  const rows = parseCsv(text, detectDelimiter(firstLine))
  if (rows.length < 2) return { offers: [], skipped: 0 }

  const map: Record<string, number> = {}
  rows[0].forEach((raw, idx) => {
    const h = raw.trim().toLowerCase()
    for (const [field, names] of Object.entries(ALIASES)) {
      if (map[field] === undefined && names.includes(h)) map[field] = idx
    }
  })

  const offers: ParsedOffer[] = []
  let skipped = 0

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row.length || row.every((c) => !c.trim())) continue
    const get = (f: string) => (map[f] !== undefined ? row[map[f]]?.trim() : undefined)

    const sku = get('sku')
    // Без артикула рядок марний: саме по ньому потім і відстежуємо товар.
    if (!sku) { skipped++; continue }

    const stock = num(get('stock'))
    const availRaw = (get('available') ?? '').toLowerCase()
    const available =
      stock != null ? stock > 0
      : availRaw ? TRUE_WORDS.has(availRaw)
      : true

    offers.push({
      offer_id: sku,
      vendor_code: sku,
      barcode: get('barcode') ?? null,
      name: get('name') ?? sku,
      price: num(get('price')),
      old_price: null,
      retail_price: num(get('retail_price')),
      wholesale_price: num(get('wholesale_price')) ?? num(get('price')),
      currency: 'UAH',
      available,
      stock_quantity: stock,
      url: null,
      picture: null,
      vendor: null,
      short_description: null,
      description: null,
    })
  }
  return { offers, skipped }
}

/* ---------------- Маршрут ---------------- */

export async function POST(req: NextRequest) {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canManageFeeds) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }

  const supabase = await createClient()
  const text = await file.text()

  const looksXml = text.trimStart().startsWith('<') || text.includes('<offer')
  const { offers, skipped } = looksXml
    ? (() => { const p = parseYmlFeed(text); return { offers: p.offers, skipped: p.skipped } })()
    : parseCsvPrice(text)

  if (!offers.length) {
    return NextResponse.json(
      { error: looksXml ? 'no_offers_in_xml' : 'no_rows_with_sku' },
      { status: 400 },
    )
  }

  const autoAdd = form?.get('auto_add') === 'true'
  const markupRaw = form?.get('markup')
  const markup = markupRaw ? Number(markupRaw) : null

  // ---------- постачальник ----------
  const existingId = typeof form?.get('feed_id') === 'string' ? String(form.get('feed_id')) : ''
  let feedId = existingId

  if (feedId) {
    const { error } = await supabase
      .from('supplier_feeds')
      .update({
        file_name: file.name,
        source_kind: 'file',
        auto_add_items: autoAdd,
        default_markup_percent: Number.isFinite(markup as number) ? markup : null,
        last_synced_at: new Date().toISOString(),
        last_status: 'ok',
        last_error: null,
        last_offers_count: offers.length,
      } as never)
      .eq('id', feedId)
      .eq('business_id', access.businessId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const name = String(form?.get('name') ?? '').trim() || file.name.replace(/\.[^.]+$/, '')
    const { data, error } = await supabase
      .from('supplier_feeds')
      .insert({
        business_id: access.businessId,
        name: name.slice(0, 120),
        url: null,
        format: looksXml ? 'yml' : 'csv',
        source_kind: 'file',
        file_name: file.name,
        is_active: true,
        auto_add_items: autoAdd,
        default_markup_percent: Number.isFinite(markup as number) ? markup : null,
        last_synced_at: new Date().toISOString(),
        last_status: 'ok',
        last_offers_count: offers.length,
      } as never)
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    feedId = (data as { id: string }).id
  }

  // ---------- офери ----------
  const startedAt = new Date().toISOString()
  const rows = offers.map((o) => ({
    business_id: access.businessId,
    feed_id: feedId,
    offer_id: o.offer_id,
    vendor_code: o.vendor_code,
    barcode: o.barcode,
    name: o.name,
    price: o.price,
    old_price: o.old_price,
    retail_price: o.retail_price ?? o.old_price,
    wholesale_price: o.wholesale_price ?? o.price,
    short_description: o.short_description,
    description: o.description,
    currency: o.currency,
    available: o.available,
    stock_quantity: o.stock_quantity,
    url: o.url,
    picture: o.picture,
    vendor: o.vendor,
    fetched_at: new Date().toISOString(),
  }))

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from('supplier_offers')
      .upsert(rows.slice(i, i + CHUNK) as never, { onConflict: 'feed_id,offer_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Позиції з попереднього файлу, яких у новому немає, постачальник зняв.
  await supabase
    .from('supplier_offers')
    .delete()
    .eq('feed_id', feedId)
    .lt('fetched_at', startedAt)

  // ---------- одразу звіряємо ----------
  // Людина щойно завантажила файл і чекає результату тут і зараз, тож не
  // відкладаємо до cron: наявність і нові товари зʼявляються в тій самій
  // відповіді.
  try {
    const report = await syncWarehouse(supabase, access.businessId)
    return NextResponse.json({
      feed_id: feedId,
      offers: rows.length,
      skipped,
      report,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[suppliers/upload] sync after upload', message)
    return NextResponse.json({ feed_id: feedId, offers: rows.length, skipped, sync_error: message })
  }
}
