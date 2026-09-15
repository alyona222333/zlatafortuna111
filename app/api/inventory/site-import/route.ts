/**
 * POST /api/inventory/site-import
 *
 * Завантаження списку товарів, вивантажених на нашому сайті (експорт
 * WooCommerce у CSV), у розділ «Склад».
 *
 * Це і є відповідь на «в файлі — товари, які вивантажені у нас на сайті»:
 * саме цей файл формує список складу. Прайси постачальників потім лише
 * проставлять по ньому наявність — нових позицій вони не додають.
 *
 * Розбір файлу і сам запис на склад лежать у lib/woocommerce-csv.ts та
 * lib/warehouse-site-import.ts — той самий код виконує й одноразовий
 * скрипт scripts/backfill-warehouse.ts, щоб «зроблене кнопкою» і
 * «зроблене скриптом» не розходилися непомітно.
 *
 * Приймає multipart/form-data:
 *   file             — сам CSV (експорт WooCommerce, будь-яка мова заголовків)
 *   skip_variations  — 'true' щоб не тягнути рядки type=variation
 *   only_published   — 'true' щоб брати лише опубліковані
 *   archive_missing  — 'true' щоб зняти зі складу товари сайту, яких у файлі
 *                      більше немає (тобто їх прибрали з сайту)
 *
 * Повторний імпорт того самого файлу нічого не ламає: збіг шукається за
 * WooCommerce ID, потім за артикулом, і рядок оновлюється, а не дублюється.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'
import { parseSiteExportCsv } from '@/lib/woocommerce-csv'
import { importSiteProducts } from '@/lib/warehouse-site-import'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canEditItems) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }

  const text = await file.text()

  let parsed
  try {
    parsed = parseSiteExportCsv(text, {
      skipVariations: form?.get('skip_variations') === 'true',
      onlyPublished: form?.get('only_published') === 'true',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (!parsed.items.length) {
    return NextResponse.json({ error: 'empty_file' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    const result = await importSiteProducts(supabase, access.businessId, parsed.items, {
      archiveMissing: form?.get('archive_missing') === 'true',
      skippedFromParsing: parsed.skippedRows,
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[site-import]', message)
    return NextResponse.json({ error: 'import_failed', message }, { status: 500 })
  }
}
