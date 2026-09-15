/**
 * Синхронізація складу з прайсами постачальників.
 *
 * НАВІЩО ЦЕЙ ФАЙЛ РОЗБИТО НА ДВІ ОКРЕМІ ФУНКЦІЇ, А НЕ ОДНУ:
 *
 * Netlify обриває серверну функцію через 10 секунд (26 — на платному
 * плані) незалежно від `export const maxDuration` у коді роута — це
 * налаштування розуміє тільки Vercel. Один запит, що качає чотири
 * зовнішні XML-прайси, а потім зводить їх із тисячами товарів складу,
 * стабільно впирався в цей ліміт і падав по таймауту без зрозумілої
 * помилки — саме це і бачив власник як «нічого не відбувається».
 *
 * Тому роботу розрізано на дрібні кроки, кожен з яких сам по собі
 * встигає завершитись до ліміту:
 *
 *   fetchFeedIntoCache()      — качає й розбирає ОДИН прайс, пише в кеш.
 *                               Викликається окремим HTTP-запитом на
 *                               кожного постачальника (по черзі з браузера).
 *   matchWarehouseAgainstOffers()
 *                             — звіряє те, що вже лежить у кеші, зі
 *                               складом. Жодних зовнішніх запитів, лише
 *                               база — швидко навіть для тисяч товарів.
 *   syncWarehouse()           — тонкий оркестратор, який викликає обидва
 *                               кроки по черзі. Використовується там, де
 *                               ліміту часу немає: у cron-задачі та в
 *                               одноразовому скрипті scripts/backfill-warehouse.ts,
 *                               яких Netlify не обриває, бо вони не є
 *                               HTTP-функціями цього хостингу.
 *
 * Роути /api/inventory/feeds/[id]/fetch-offers і /api/inventory/feeds/match
 * викликають перші дві функції окремо — це і є той самий алгоритм, просто
 * розділений на кроки, а не переписаний заново.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchFeed,
  parseYmlFeed,
  matchItemsToOffers,
  normArticle,
  type MatchableItem,
  type MatchableOffer,
} from './supplier-feeds'

const CHUNK = 500

export interface FeedSyncReport {
  feed_id: string
  name: string
  url: string | null
  status: 'ok' | 'error' | 'skipped'
  offers: number
  skipped: number
  added_items?: number
  error?: string
}

export interface MatchReport {
  total_offers: number
  items_checked: number
  matched: number
  unmatched: number
  in_stock: number
  out_of_stock: number
  added_items: number
  went_out_of_stock: number
  back_in_stock: number
  dropped_by_supplier: number
  finished_at: string
}

export interface SyncReport extends MatchReport {
  feeds: FeedSyncReport[]
}

interface FeedRow {
  id: string
  name: string
  url: string | null
  source_kind: string
  is_active: boolean
  write_quantity: boolean
  auto_add_items: boolean
  notify_out_of_stock: boolean
  default_stock_when_available: number
  default_markup_percent: number | null
}

/**
 * Було послідовним `for` з `await` всередині — для фіда на 70к+ офферів
 * (Luxyart/«Текстиль») це ~140 послідовних запитів у Supabase поспіль,
 * що впритул чи з запасом вибиває ліміт часу серверної функції на Netlify
 * ще ДО того, як `fetchFeedIntoCache` встигне дописати last_synced_at.
 * Функцію просто вбиває мідсинку — тому в UI назавжди «У файлі: 0» і
 * «Оновлено: —»: спроба синхронізації навіть не долітає до кінця, щоб
 * записати помилку.
 *
 * Виправлення: гнати чанки пачками паралельно (PARALLEL штук одночасно),
 * а не по одному — той самий обсяг запитів, але за набагато менший
 * астрономічний час.
 */
const PARALLEL = 6

async function chunked<T>(rows: T[], fn: (slice: T[]) => Promise<void>) {
  const slices: T[][] = []
  for (let i = 0; i < rows.length; i += CHUNK) slices.push(rows.slice(i, i + CHUNK))

  for (let i = 0; i < slices.length; i += PARALLEL) {
    await Promise.all(slices.slice(i, i + PARALLEL).map(fn))
  }
}

/** Витягує ВСІ рядки посторінково — Supabase ріже select на 1000. */
async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1)
    if (error) throw new Error(String((error as { message?: string }).message ?? error))
    if (!data?.length) break
    out.push(...data)
    if (data.length < page) break
  }
  return out
}

/* ==================================================================== *
 * Крок 1: качаємо і кешуємо ОДИН прайс. Один зовнішній запит на виклик —
 * саме він і був вузьким місцем таймауту, тому винесений окремо.
 * ==================================================================== */

export async function fetchFeedIntoCache(
  supabase: SupabaseClient,
  businessId: string,
  feedId: string,
): Promise<FeedSyncReport> {
  const { data: feed, error: feedErr } = await supabase
    .from('supplier_feeds')
    .select('id, name, url, source_kind')
    .eq('id', feedId)
    .eq('business_id', businessId)
    .single()

  if (feedErr || !feed) {
    throw new Error(feedErr?.message ?? 'feed_not_found')
  }
  const f = feed as unknown as Pick<FeedRow, 'id' | 'name' | 'url' | 'source_kind'>

  // Файловий прайс нікуди не ходить: його офери потрапили в кеш при
  // завантаженні файлу і живуть там до наступного завантаження.
  if (f.source_kind === 'file' || !f.url) {
    const { count } = await supabase
      .from('supplier_offers')
      .select('id', { count: 'exact', head: true })
      .eq('feed_id', f.id)
    return { feed_id: f.id, name: f.name, url: f.url, status: 'skipped', offers: count ?? 0, skipped: 0 }
  }

  try {
    const xml = await fetchFeed(f.url)
    const parsed = parseYmlFeed(xml)

    const startedAt = new Date().toISOString()
    const rows = parsed.offers.map((o) => ({
      business_id: businessId,
      feed_id: f.id,
      offer_id: o.offer_id,
      vendor_code: o.vendor_code,
      barcode: o.barcode,
      name: o.name,
      price: o.price,
      old_price: o.old_price,
      retail_price: o.retail_price,
      wholesale_price: o.wholesale_price,
      currency: o.currency,
      available: o.available,
      stock_quantity: o.stock_quantity,
      url: o.url,
      picture: o.picture,
      vendor: o.vendor,
      short_description: o.short_description,
      description: o.description,
      fetched_at: new Date().toISOString(),
    }))

    await chunked(rows, async (slice) => {
      const { error } = await supabase
        .from('supplier_offers')
        .upsert(slice as never, { onConflict: 'feed_id,offer_id' })
      if (error) throw new Error(error.message)
    })

    // Позиції, яких у новому вивантаженні вже немає, постачальник зняв.
    await supabase.from('supplier_offers').delete().eq('feed_id', f.id).lt('fetched_at', startedAt)

    await supabase
      .from('supplier_feeds')
      .update({
        last_synced_at: new Date().toISOString(),
        last_status: 'ok',
        last_error: null,
        last_offers_count: rows.length,
      } as never)
      .eq('id', f.id)

    return { feed_id: f.id, name: f.name, url: f.url, status: 'ok', offers: rows.length, skipped: parsed.skipped }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[warehouse-sync] feed failed', f.url, msg)
    await supabase
      .from('supplier_feeds')
      .update({
        last_synced_at: new Date().toISOString(),
        last_status: 'error',
        last_error: msg.slice(0, 500),
      } as never)
      .eq('id', f.id)
    return { feed_id: f.id, name: f.name, url: f.url, status: 'error', offers: 0, skipped: 0, error: msg }
  }
}

/* ==================================================================== *
 * Крок 2: звіряємо те, що вже в кеші, зі складом. Жодних зовнішніх
 * запитів — тільки база, тому навіть для тисяч товарів встигає в ліміт.
 * ==================================================================== */

export async function matchWarehouseAgainstOffers(
  supabase: SupabaseClient,
  businessId: string,
): Promise<MatchReport> {
  const { data: settings } = await supabase
    .from('warehouse_settings')
    .select('sync_availability, missing_offer_policy')
    .eq('business_id', businessId)
    .maybeSingle()

  const syncAvailability = settings?.sync_availability ?? true
  const missingPolicy = settings?.missing_offer_policy ?? 'unknown'
  const now = new Date().toISOString()

  const empty: MatchReport = {
    total_offers: 0, items_checked: 0, matched: 0, unmatched: 0, in_stock: 0, out_of_stock: 0,
    added_items: 0, went_out_of_stock: 0, back_in_stock: 0, dropped_by_supplier: 0,
    finished_at: now,
  }
  if (!syncAvailability) return empty

  const { data: feedsRaw } = await supabase
    .from('supplier_feeds')
    .select(
      'id, name, url, source_kind, is_active, write_quantity, auto_add_items, ' +
      'notify_out_of_stock, default_stock_when_available, default_markup_percent',
    )
    .eq('business_id', businessId)
    .eq('is_active', true)
  const feeds = (feedsRaw ?? []) as unknown as FeedRow[]
  const feedById = new Map(feeds.map((f) => [f.id, f]))

  // ---------- Стан складу ДО звірки ----------
  interface ItemBefore extends MatchableItem {
    supplier_available: boolean | null
    supplier_offer_id: string | null
    supplier_feed_id: string | null
  }

  const loadItems = () =>
    selectAll<ItemBefore>((from, to) =>
      supabase
        .from('inventory_items')
        .select('id, sku, barcode, name, source, track_supplier, supplier_available, supplier_offer_id, supplier_feed_id')
        .eq('business_id', businessId)
        .eq('is_archived', false)
        .or('source.eq.site,track_supplier.eq.true')
        .range(from, to),
    )

  let items = await loadItems()

  const offers = await selectAll<MatchableOffer & { picture: string | null }>((from, to) =>
    supabase
      .from('supplier_offers')
      .select('id, feed_id, offer_id, vendor_code, barcode, name, price, old_price, retail_price, wholesale_price, available, stock_quantity, url, picture, short_description, description')
      .eq('business_id', businessId)
      .range(from, to),
  )

  // Прайс постачальника ніколи не є джерелом списку складу. Навіть якщо
  // для старого запису залишився прапорець auto_add_items, нові рядки з
  // прайсу не створюємо: спочатку товар має потрапити до експорту сайту.
  const addedTotal = 0

  // ---------- Звірка і запис наявності ----------
  const { matches, unmatched } = matchItemsToOffers(items, offers)
  const before = new Map(items.map((i) => [i.id, i]))

  let inStock = 0
  let outOfStock = 0

  interface Alert {
    business_id: string
    item_id: string
    feed_id: string | null
    kind: 'out_of_stock' | 'back_in_stock' | 'dropped'
    item_name: string
    sku: string | null
    supplier_name: string | null
  }
  const alerts: Alert[] = []

  const updates = matches.map(({ item_id, offer, match_type }) => {
    const feed = feedById.get(offer.feed_id)
    const prev = before.get(item_id)
    if (offer.available) inStock++
    else outOfStock++

    // Сповіщаємо тільки на зміні стану. Товар, який лежить «немає»
    // третій тиждень, не має щогодини смикати керівника.
    if (feed?.notify_out_of_stock !== false && prev) {
      if (prev.supplier_available === true && offer.available === false) {
        alerts.push({
          business_id: businessId, item_id, feed_id: offer.feed_id, kind: 'out_of_stock',
          item_name: prev.name, sku: prev.sku, supplier_name: feed?.name ?? null,
        })
      } else if (prev.supplier_available === false && offer.available === true) {
        alerts.push({
          business_id: businessId, item_id, feed_id: offer.feed_id, kind: 'back_in_stock',
          item_name: prev.name, sku: prev.sku, supplier_name: feed?.name ?? null,
        })
      }
    }

    const row: Record<string, unknown> = {
      id: item_id,
      supplier_feed_id: offer.feed_id,
      supplier_offer_id: offer.offer_id,
      supplier_available: offer.available,
      supplier_stock: offer.stock_quantity,
      supplier_price: offer.wholesale_price ?? offer.price,
      supplier_retail_price: offer.retail_price ?? offer.old_price ?? offer.price,
      supplier_url: offer.url,
      supplier_match_type: match_type,
      supplier_checked_at: now,
      write_quantity: !!feed?.write_quantity,
      quantity: offer.stock_quantity != null
        ? offer.stock_quantity
        : offer.available
          ? Number(feed?.default_stock_when_available ?? 10)
          : 0,
    }
    return row
  })

  // Товар, який раніше був у прайсі, а тепер зник з нього зовсім.
  for (const itemId of unmatched) {
    const prev = before.get(itemId)
    if (prev?.supplier_offer_id) {
      alerts.push({
        business_id: businessId,
        item_id: itemId,
        feed_id: prev.supplier_feed_id,
        kind: 'dropped',
        item_name: prev.name,
        sku: prev.sku,
        supplier_name: prev.supplier_feed_id ? feedById.get(prev.supplier_feed_id)?.name ?? null : null,
      })
    }
  }

  const { error: batchError } = await (supabase.rpc as any)('sync_inventory_supplier_batch', {
    p_business_id: businessId,
    p_updates: updates.map(({ id, ...row }) => ({ item_id: id, ...row })),
    p_clear_ids: unmatched,
    p_missing_supplier_available: missingPolicy === 'zero',
  })
  if (batchError) throw new Error(`supplier_batch_failed: ${batchError.message}`)

  // ---------- Журнал подій ----------
  // «Повернувся в наявність» закриває старе непрочитане «закінчився»:
  // інакше частковий унікальний індекс не дасть створити нову подію,
  // та й тримати обидві одночасно безглуздо.
  const backIds = alerts.filter((a) => a.kind === 'back_in_stock').map((a) => a.item_id)
  if (backIds.length) {
    await chunked(backIds, async (slice) => {
      await supabase
        .from('stock_alerts')
        .update({ is_read: true } as never)
        .in('item_id', slice)
        .eq('kind', 'out_of_stock')
        .eq('is_read', false)
    })
  }

  if (alerts.length) {
    // Унікальний індекс на (item_id, kind) — ЧАСТКОВИЙ (лише для непрочитаних),
    // а ON CONFLICT з частковим індексом Postgres не приймає. Тому дублі
    // відсіюємо тут: читаємо, що вже висить непрочитаним, і вставляємо решту.
    const { data: openAlerts } = await supabase
      .from('stock_alerts')
      .select('item_id, kind')
      .eq('business_id', businessId)
      .eq('is_read', false)

    const already = new Set((openAlerts ?? []).map((a) => `${a.item_id}:${a.kind}`))
    const fresh = alerts.filter((a) => !already.has(`${a.item_id}:${a.kind}`))

    await chunked(fresh, async (slice) => {
      const { error } = await supabase.from('stock_alerts').insert(slice as never)
      if (error) console.error('[warehouse-sync] alerts', error.message)
    })
  }

  const perFeed = new Map<string, number>()
  for (const m of matches) perFeed.set(m.offer.feed_id, (perFeed.get(m.offer.feed_id) ?? 0) + 1)
  for (const feed of feeds) {
    // Matched — точное число оферов этого фида, сопоставленных с товарами
    // каталога. Даже ноль нужно записать, иначе на экране остаётся старое
    // значение после предыдущей синхронизации.
    const count = perFeed.get(feed.id) ?? 0
    await supabase.from('supplier_feeds').update({ last_matched_count: count } as never).eq('id', feed.id)
  }

  return {
    total_offers: offers.length,
    items_checked: items.length,
    matched: matches.length,
    unmatched: unmatched.length,
    in_stock: inStock,
    out_of_stock: outOfStock,
    added_items: addedTotal,
    went_out_of_stock: alerts.filter((a) => a.kind === 'out_of_stock').length,
    back_in_stock: alerts.filter((a) => a.kind === 'back_in_stock').length,
    dropped_by_supplier: alerts.filter((a) => a.kind === 'dropped').length,
    finished_at: now,
  }
}

/* ==================================================================== *
 * Оркестратор для середовищ БЕЗ обмеження часу: cron-задача і
 * scripts/backfill-warehouse.ts. У браузері цю функцію напряму не
 * викликають — там кроки виконуються по одному через окремі HTTP-запити
 * (див. коментар угорі файлу).
 * ==================================================================== */

export async function syncWarehouse(
  supabase: SupabaseClient,
  businessId: string,
  opts: { feedId?: string } = {},
): Promise<SyncReport> {
  let feedIdsQuery = supabase
    .from('supplier_feeds')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_active', true)
  if (opts.feedId) feedIdsQuery = feedIdsQuery.eq('id', opts.feedId)

  const { data: feedRows, error } = await feedIdsQuery
  if (error) throw new Error(error.message)

  const feeds: FeedSyncReport[] = []
  for (const row of feedRows ?? []) {
    feeds.push(await fetchFeedIntoCache(supabase, businessId, (row as { id: string }).id))
  }

  const matchReport = await matchWarehouseAgainstOffers(supabase, businessId)
  return { feeds, ...matchReport }
}
