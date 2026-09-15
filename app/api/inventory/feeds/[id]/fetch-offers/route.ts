/**
 * POST /api/inventory/feeds/[id]/fetch-offers — качає й кешує ОДИН прайс.
 *
 * Навмисно окремий роут на кожного постачальника, а не «оновити все одним
 * запитом»: якщо якщо якийсь конкретний фід повільний чи великий, він не
 * тягне за собою таймаут для решти — кожен постачальник має власний бюджет
 * часу. Браузер викликає цей роут по черзі для кожного активного
 * постачальника, потім один раз — /api/inventory/feeds/match.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'
import { fetchFeedIntoCache } from '@/lib/warehouse-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canEditItems) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createClient()

  try {
    const report = await fetchFeedIntoCache(supabase, access.businessId, id)
    return NextResponse.json(report)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[feeds/fetch-offers]', message)
    return NextResponse.json({ error: 'fetch_failed', message }, { status: 500 })
  }
}
