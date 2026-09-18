/**
 * DELETE /api/inventory/site-import/clear
 *
 * Видаляє товари з джерел site і supplier. supplier тут — лише старі
 * автозаписи попередньої версії, яка помилково додавала весь прайс у склад.
 * Ручні товари, самі прайси та їхні налаштування не зачіпаються.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canEditItems) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { error, count } = await supabase
    .from('inventory_items')
    .delete({ count: 'exact' })
    .eq('business_id', access.businessId)
    .in('source', ['site', 'supplier'])

  if (error) {
    console.error('[site-import/clear]', error.message)
    return NextResponse.json({ error: 'clear_failed', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: count ?? 0 })
}
