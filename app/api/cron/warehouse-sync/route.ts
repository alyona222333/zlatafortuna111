/**
 * GET /api/cron/warehouse-sync?secret=CRON_SECRET
 *
 * Автоматичне оновлення наявності з прайсів постачальників — БЕЗ ризику
 * впертись у таймаут serverless-хостингу.
 *
 * Раніше цей маршрут якав усі прайси бізнесу і одразу зводив їх зі
 * складом в ОДНОМУ виклику. Netlify (і більшість інших serverless-
 * хостингів) обриває функцію через 10–26 секунд незалежно від
 * `maxDuration` нижче — це налаштування розуміє тільки Vercel. Кілька
 * великих прайсів разом із тисячами товарів складу в одному виклику
 * стабільно впирались у цей ліміт.
 *
 * Тому кожен виклик цього ендпоінта робить РІВНО ОДНУ дрібну дію:
 *
 *   1. Якщо є прострочений прайс (не оновлювався довше за
 *      auto_sync_minutes) — качає й кешує ОДИН такий прайс, виходить.
 *   2. Інакше, якщо після останньої підкачки склад ще не звірявся —
 *      звіряє склад із кешем (без жодного зовнішнього запиту), виходить.
 *   3. Інакше — для цього бізнесу зараз нічого не потрібно, переходить
 *      до наступного бізнесу.
 *
 * Зовнішній планувальник (cron-job.org тощо) має стукати сюди часто —
 * раз на 3–5 хвилин, а не раз на годину: сама частота оновлення
 * (`auto_sync_minutes`) керується цими даними, а не частотою виклику
 * цього URL. Часті дешеві тіки — і є заміна одного важкого виклику раз
 * на годину.
 *
 * Працює під service-role ключем: cron приходить без сесії користувача,
 * тож RLS тут обійти доводиться — доступ захищає `secret` у рядку запиту,
 * так само як у /api/cron/notify.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchFeedIntoCache, matchWarehouseAgainstOffers } from '@/lib/warehouse-sync'

export const dynamic = 'force-dynamic'

interface FeedRow {
  id: string
  business_id: string
  last_synced_at: string | null
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: feedsRaw, error } = await supabase
    .from('supplier_feeds')
    .select('id, business_id, last_synced_at')
    .eq('is_active', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const feeds = (feedsRaw ?? []) as unknown as FeedRow[]
  const businessIds = [...new Set(feeds.map((f) => f.business_id))]

  for (const businessId of businessIds) {
    const { data: settings } = await supabase
      .from('warehouse_settings')
      .select('auto_sync_minutes, sync_availability, last_matched_at')
      .eq('business_id', businessId)
      .maybeSingle()

    if (settings?.sync_availability === false) continue

    const intervalMin = Number(settings?.auto_sync_minutes ?? 60)
    const businessFeeds = feeds.filter((f) => f.business_id === businessId)

    // ---------- Крок 1: чи є прострочений прайс? ----------
    const dueFeed = businessFeeds.find((f) => {
      if (!f.last_synced_at) return true
      if (intervalMin <= 0) return false
      return Date.now() - new Date(f.last_synced_at).getTime() >= intervalMin * 60_000
    })

    if (dueFeed) {
      try {
        const report = await fetchFeedIntoCache(supabase, businessId, dueFeed.id)
        return NextResponse.json({ step: 'fetch_feed', business_id: businessId, report })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error('[cron/warehouse-sync] fetch failed', businessId, dueFeed.id, message)
        return NextResponse.json(
          { step: 'fetch_feed', business_id: businessId, feed_id: dueFeed.id, error: message },
          { status: 500 },
        )
      }
    }

    // ---------- Крок 2: чи звірку вже проводили після останньої підкачки? ----------
    const latestFetch = businessFeeds
      .map((f) => (f.last_synced_at ? new Date(f.last_synced_at).getTime() : 0))
      .reduce((max, t) => Math.max(max, t), 0)
    const lastMatch = settings?.last_matched_at ? new Date(settings.last_matched_at).getTime() : 0

    if (latestFetch > lastMatch) {
      try {
        const report = await matchWarehouseAgainstOffers(supabase, businessId)
        await supabase
          .from('warehouse_settings')
          .upsert(
            { business_id: businessId, last_matched_at: new Date().toISOString() } as never,
            { onConflict: 'business_id' },
          )
        return NextResponse.json({ step: 'match', business_id: businessId, report })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error('[cron/warehouse-sync] match failed', businessId, message)
        return NextResponse.json({ step: 'match', business_id: businessId, error: message }, { status: 500 })
      }
    }

    // Для цього бізнесу зараз робити нічого — пробуємо наступний.
  }

  return NextResponse.json({ step: 'idle', businesses: businessIds.length })
}
