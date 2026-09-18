/**
 * POST /api/inventory/items/bulk — масові дії над товарами складу.
 *
 * Це та сама вимога «щоб можна було додати або прибрати товари», але для
 * позначених галочками рядків, а не по одному.
 *
 * Тіло: { ids: string[], action: 'archive' | 'restore' | 'untrack' | 'track' | 'delete' }
 *
 *   archive  — прибрати зі складу, лишивши історію (типове «прибрати»);
 *   restore  — повернути назад;
 *   untrack  — лишити в списку, але не оновлювати наявність з прайсу
 *              (для товарів, які ведемо власним залишком);
 *   track    — повернути під синхронізацію;
 *   delete   — стерти назавжди; доступно лише власнику/директору, бо
 *              разом з рядком каскадом іде історія рухів по товару.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'

const ACTIONS = ['archive', 'restore', 'untrack', 'track', 'delete'] as const
type Action = (typeof ACTIONS)[number]

const MAX_IDS = 5000
const CHUNK = 500

export async function POST(request: Request) {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canEditItems) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid_json' }, { status: 400 })

  const action = body.action as Action
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
  }

  const ids: string[] = Array.isArray(body.ids)
    ? body.ids.filter((v: unknown) => typeof v === 'string').slice(0, MAX_IDS)
    : []
  if (!ids.length) return NextResponse.json({ error: 'ids_required' }, { status: 400 })

  if (action === 'delete' && !access.canManageFeeds) {
    // Менеджер може «прибрати» (archive) — це оборотно. Безповоротне
    // видалення разом з історією рухів лишаємо керівнику.
    return NextResponse.json({ error: 'delete_requires_director' }, { status: 403 })
  }

  const supabase = await createClient()
  let affected = 0

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)

    if (action === 'delete') {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .in('id', slice)
        .eq('business_id', access.businessId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      affected += slice.length
      continue
    }

    const patch: Record<string, unknown> =
      action === 'archive'
        ? { is_archived: true, track_supplier: false }
        : action === 'restore'
          ? { is_archived: false, track_supplier: true }
          : action === 'untrack'
            ? { track_supplier: false }
            : { track_supplier: true }

    const { error } = await supabase
      .from('inventory_items')
      .update(patch as never)
      .in('id', slice)
      .eq('business_id', access.businessId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    affected += slice.length
  }

  return NextResponse.json({ ok: true, action, affected })
}
