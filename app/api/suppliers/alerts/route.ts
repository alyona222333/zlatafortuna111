/**
 * GET   /api/suppliers/alerts        — події наявності (що закінчилось, що повернулось)
 * PATCH /api/suppliers/alerts        — позначити прочитаним: { ids: [...] } або { all: true }
 *
 * Журнал бачить лише керівник — це частина розділу «Постачальники».
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'

export async function GET(req: NextRequest) {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canManageFeeds) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const onlyUnread = req.nextUrl.searchParams.get('unread') === 'true'
  const limit = Math.min(200, Number(req.nextUrl.searchParams.get('limit') ?? 50) || 50)

  const supabase = await createClient()

  let q = supabase
    .from('stock_alerts')
    .select('*')
    .eq('business_id', access.businessId)
  if (onlyUnread) q = q.eq('is_read', false)

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count: unread } = await supabase
    .from('stock_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', access.businessId)
    .eq('is_read', false)

  return NextResponse.json({ alerts: data ?? [], unread: unread ?? 0 })
}

export async function PATCH(request: Request) {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canManageFeeds) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const supabase = await createClient()

  let q = supabase
    .from('stock_alerts')
    .update({ is_read: true } as never)
    .eq('business_id', access.businessId)
    .eq('is_read', false)

  if (!body.all) {
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((v: unknown) => typeof v === 'string')
      : []
    if (!ids.length) return NextResponse.json({ error: 'ids_required' }, { status: 400 })
    q = q.in('id', ids)
  }

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
