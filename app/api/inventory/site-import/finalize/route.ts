/**
 * POST /api/inventory/site-import/finalize
 *
 * Останній крок чанкованого імпорту CSV сайту: якщо просили «прибрати
 * те, чого немає у файлі», знімає зі складу товари сайту, яких жодна
 * порція цього запуску не торкнулась.
 *
 * Чому окремим кроком, а не одразу під час завантаження: коли товари
 * заносяться сотнями по кілька окремих запитів (див.
 * /api/inventory/site-import/batch), жоден окремий запит не бачить
 * повної картини «що взагалі було у файлі» — тільки свою порцію.
 * Позначити пропущене можна лише після того, як усі порції вже записані.
 *
 * Тіло: { run_started_at: string /* ISO * / }
 *
 * Товар вважається пропущеним, якщо його updated_at старіший за момент
 * старту цього запуску, — тобто жодна порція його не торкнулась. Кожен
 * insert/update у importSiteProducts() виставляє updated_at на «зараз»
 * (через колонку за замовчуванням при вставці і тригер при оновленні),
 * тож цей момент — надійна межа.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'

const CHUNK = 500

export async function POST(request: Request) {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canEditItems) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const runStartedAt = typeof body.run_started_at === 'string' ? body.run_started_at : null
  if (!runStartedAt) return NextResponse.json({ error: 'run_started_at_required' }, { status: 400 })

  const supabase = await createClient()

  const { data: stale, error: selectErr } = await supabase
    .from('inventory_items')
    .select('id')
    .eq('business_id', access.businessId)
    .eq('source', 'site')
    .eq('is_archived', false)
    .lt('updated_at', runStartedAt)

  if (selectErr) return NextResponse.json({ error: selectErr.message }, { status: 500 })

  const ids = (stale ?? []).map((r) => (r as { id: string }).id)
  let archived = 0

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('inventory_items')
      .update({ is_archived: true, track_supplier: false } as never)
      .in('id', slice)
    if (!error) archived += slice.length
  }

  return NextResponse.json({ archived })
}
