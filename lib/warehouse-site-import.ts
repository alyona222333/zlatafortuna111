/**
 * Запис розібраного списку товарів сайту у «Склад».
 *
 * Винесено з app/api/inventory/site-import/route.ts з тієї ж причини, що
 * і lib/woocommerce-csv.ts: цю саму функцію викликає і завантаження файлу
 * через інтерфейс, і одноразовий скрипт scripts/backfill-warehouse.ts.
 * Обидва шляхи мають писати на склад однаково — інакше «зроблене руками
 * через кнопку» і «зроблене скриптом» розійшлися б непомітно.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SiteProduct } from './woocommerce-csv'
import { normArticle } from './supplier-feeds'

const CHUNK = 400

export interface SiteImportResult {
  created: number
  updated: number
  skipped: number
  archived: number
}

export interface SiteImportOptions {
  /** Зняти зі складу (в архів) товари сайту, яких немає серед переданих items. */
  archiveMissing?: boolean
  /** Скільки рядків уже відкинуто на етапі розбору файлу — просто йде у підсумок. */
  skippedFromParsing?: number
}

export async function importSiteProducts(
  supabase: SupabaseClient,
  businessId: string,
  items: SiteProduct[],
  opts: SiteImportOptions = {},
): Promise<SiteImportResult> {
  let skippedRows = opts.skippedFromParsing ?? 0

  if (!items.length) {
    return { created: 0, updated: 0, skipped: skippedRows, archived: 0 }
  }

  // ---------- що вже є на складі ----------
  const existing: { id: string; external_id: string | null; sku: string | null; manual_overrides?: Record<string, boolean> | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id, external_id, sku, manual_overrides')
      .eq('business_id', businessId)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    existing.push(...(data as never as { id: string; external_id: string | null; sku: string | null; manual_overrides?: Record<string, boolean> | null }[]))
    if (data.length < 1000) break
  }

  const byExternal = new Map<string, string>()
  const bySku = new Map<string, string>()
  for (const e of existing) {
    if (e.external_id) byExternal.set(e.external_id, e.id)
    const normalized = normArticle(e.sku)
    if (normalized && !bySku.has(normalized)) bySku.set(normalized, e.id)
  }

  const toInsert: Record<string, unknown>[] = []
  const toUpdate: Record<string, unknown>[] = []
  const seenIds = new Set<string>()
  // Дублі всередині самого файлу (той самий артикул двічі) інакше пішли б
  // двома insert-ами і впали б на унікальному індексі по SKU.
  const seenSkusInFile = new Set<string>()

  for (const it of items) {
    const normalizedSku = normArticle(it.sku)
    const hit =
      (it.external_id && byExternal.get(it.external_id)) ||
      (normalizedSku && bySku.get(normalizedSku)) ||
      null

  const base = {
      name: it.name,
      sku: it.sku,
      barcode: it.barcode,
      category: it.category,
      image_url: it.image_url,
      product_url: it.product_url,
      description: it.short_description,
      long_description: it.long_description,
      site_regular_price: it.regular_price,
      site_sale_price: it.sale_price,
      site_short_description: it.short_description,
      site_attributes: it.attributes,
      sell_price: it.sell_price,
      // dropship_price навмисно НЕ пишемо тут: це ціна від постачальника
      // (виставляється при зіставленні з прайсом, lib/warehouse-sync.ts, або
      // вручну в картці товару). Раніше тут стояло `dropship_price: it.sell_price`,
      // тож кожен повторний імпорт сайту тер справжню оптову ціну і підміняв
      // її ціною сайту — звідси в «Складі» «Опт дропшипера» співпадав з
      // «Ціна сайту» для будь-якого товару.
      external_id: it.external_id,
      source: 'site',
      is_archived: false,
    }

    if (hit) {
      seenIds.add(hit)
      const old = existing.find((e) => e.id === hit)
      const overrides = old?.manual_overrides ?? {}
      const protectedBase = Object.fromEntries(Object.entries(base).filter(([key]) => !overrides[key]))
      toUpdate.push({ id: hit, ...protectedBase, is_archived: false })
    } else {
      if (normalizedSku) {
        if (seenSkusInFile.has(normalizedSku)) { skippedRows++; continue }
        seenSkusInFile.add(normalizedSku)
      }
      toInsert.push({
        business_id: businessId,
        ...base,
        unit: 'pcs',
        quantity: it.quantity ?? 0,
        low_stock_threshold: it.low_stock_threshold ?? 5,
        track_supplier: true,
      })
    }
  }

  let created = 0
  let updated = 0

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const slice = toInsert.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('inventory_items')
      .insert(slice as never)
      .select('id')
    if (error) throw new Error(`insert_failed: ${error.message}`)
    created += data?.length ?? 0
      for (const d of data ?? []) seenIds.add((d as { id: string }).id)
  }

  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const slice = toUpdate.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('inventory_items')
      .upsert(slice as never, { onConflict: 'id' })
    if (error) throw new Error(`update_failed: ${error.message}`)
    updated += slice.length
  }

  // ---------- товари, які прибрали з сайту ----------
  let archived = 0
  if (opts.archiveMissing === true) {
    const stale = existing.filter((e) => !seenIds.has(e.id)).map((e) => e.id)
    for (let i = 0; i < stale.length; i += CHUNK) {
      const slice = stale.slice(i, i + CHUNK)
      const { error } = await supabase
        .from('inventory_items')
        .update({ is_archived: true, track_supplier: false } as never)
        .in('id', slice)
        .eq('business_id', businessId)
        .eq('source', 'site')
      if (!error) archived += slice.length
    }
  }

  return { created, updated, skipped: skippedRows, archived }
}
