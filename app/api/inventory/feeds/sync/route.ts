/**
 * POST /api/inventory/feeds/sync — «Оновити наявність зараз» ОДНИМ запитом.
 *
 * ⚠️ Кнопки в інтерфейсі більше НЕ викликають цей маршрут. Netlify (і
 * більшість інших serverless-хостингів) обриває функцію через 10–26
 * секунд, а качання кількох прайсів + звірка з тисячами товарів довше
 * цього — `export const maxDuration` тут спрацьовує тільки на Vercel.
 * Інтерфейс тепер робить те саме дрібними кроками з браузера:
 * POST /api/inventory/feeds/[id]/fetch-offers по черзі на кожного
 * постачальника, потім один раз POST /api/inventory/feeds/match —
 * логіка та сама (lib/warehouse-sync.ts), просто розрізана на шматки,
 * жоден з яких не впирається в ліміт.
 *
 * Цей маршрут лишається для середовищ БЕЗ такого ліміту — прямий виклик
 * з довіреного бекенду чи локального скрипта. Для Netlify не
 * використовуйте його напряму з браузера: ризик того самого таймауту.
 *
 * Тіло (необовʼязкове): { "feed_id": "…" } — оновити лише одного постачальника.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'
import { syncWarehouse } from '@/lib/warehouse-sync'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canEditItems) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const feedId = typeof body.feed_id === 'string' ? body.feed_id : undefined

  const supabase = await createClient()

  try {
    const report = await syncWarehouse(supabase, access.businessId, { feedId })
    return NextResponse.json(report)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[inventory/feeds/sync]', message)
    return NextResponse.json({ error: 'sync_failed', message }, { status: 500 })
  }
}
