/**
 * POST /api/inventory/site-import/batch — записати ОДНУ порцію товарів сайту.
 *
 * Чому не одним запитом, як раніше: Netlify обриває серверну функцію
 * через 10 секунд (26 на платному плані), а розбір 19 МБ CSV і запис
 * тисяч товарів у 500-рядкових чанках у сумі займає більше. Один великий
 * запит просто падав по таймауту — не через помилку в даних чи коді,
 * а через ліміт хостингу, який `export const maxDuration` на Netlify не
 * скасовує (це налаштування розуміє тільки Vercel).
 *
 * Тому розбір файлу тепер відбувається в браузері (де немає таймаута
 * взагалі), а на сервер летять маленькі порції по кілька сотень товарів —
 * кожен запит встигає завершитись задовго до ліміту.
 *
 * Тіло: { items: SiteProduct[] } — уже розібрані рядки, без raw CSV.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'
import { importSiteProducts } from '@/lib/warehouse-site-import'
import type { SiteProduct } from '@/lib/woocommerce-csv'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canEditItems) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const items = Array.isArray(body?.items) ? (body.items as SiteProduct[]) : null
  if (!items || !items.length) {
    return NextResponse.json({ error: 'items_required' }, { status: 400 })
  }
  // Одна порція — максимум пів тисячі. Більше — знову ризик таймауту.
  if (items.length > 500) {
    return NextResponse.json({ error: 'batch_too_large' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    const result = await importSiteProducts(supabase, access.businessId, items, {})
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[site-import/batch]', message)
    return NextResponse.json({ error: 'import_failed', message }, { status: 500 })
  }
}
