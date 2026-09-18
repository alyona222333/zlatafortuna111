/**
 * POST /api/inventory/feeds/match — звірити склад із уже завантаженими
 * прайсами (без жодного зовнішнього запиту).
 *
 * Викликається один раз після того, як браузер по черзі прогнав
 * /api/inventory/feeds/[id]/fetch-offers по кожному активному
 * постачальнику. Сама звірка — це лише читання й запис у власну базу,
 * тому навіть для тисяч товарів встигає завершитись задовго до ліміту
 * серверної функції.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'
import { matchWarehouseAgainstOffers } from '@/lib/warehouse-sync'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canEditItems) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createClient()

  try {
    const body = await request.json().catch(() => ({})) as { feed_ids?: unknown }
    const feedIds = Array.isArray(body.feed_ids) ? body.feed_ids.filter((id): id is string => typeof id === 'string') : undefined
    const report = await matchWarehouseAgainstOffers(supabase, access.businessId, feedIds)
    return NextResponse.json(report)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[feeds/match]', message)
    return NextResponse.json({ error: 'match_failed', message }, { status: 500 })
  }
}
