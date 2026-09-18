/**
 * GET  /api/inventory/feeds — список прайсів постачальників + стан складу
 * POST /api/inventory/feeds — додати посилання на прайс
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWarehouseAccess } from '@/lib/warehouse-access'

export async function GET() {
  const access = await getWarehouseAccess()
  if (!access?.canRead) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createClient()

  const { data: feeds, error } = await supabase
    .from('supplier_feeds')
    .select('*')
    .eq('business_id', access.businessId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: overview } = await supabase
    .from('warehouse_overview')
    .select('*')
    .eq('business_id', access.businessId)
    .maybeSingle()

  const { data: settings } = await supabase
    .from('warehouse_settings')
    .select('*')
    .eq('business_id', access.businessId)
    .maybeSingle()

  return NextResponse.json({
    feeds: feeds ?? [],
    overview: overview ?? null,
    settings: settings ?? {
      business_id: access.businessId,
      sync_availability: true,
      missing_offer_policy: 'unknown',
      auto_sync_minutes: 60,
    },
    can_manage_feeds: access.canManageFeeds,
  })
}

export async function POST(request: Request) {
  const access = await getWarehouseAccess()
  if (!access) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!access.canManageFeeds) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid_json' }, { status: 400 })

  const url = String(body.url ?? '').trim()
  const name = String(body.name ?? '').trim()

  if (!url || !name) {
    return NextResponse.json({ error: 'name_and_url_required' }, { status: 400 })
  }

  // Прайс качає наш сервер, а не браузер користувача, тож довільний URL тут —
  // це SSRF у бік внутрішньої мережі. Пускаємо лише http(s) і публічні хости.
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return NextResponse.json({ error: 'invalid_protocol' }, { status: 400 })
  }
  const host = parsed.hostname.toLowerCase()
  const isPrivate =
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  if (isPrivate) {
    return NextResponse.json({ error: 'private_host_not_allowed' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_feeds')
    .insert({
      business_id: access.businessId,
      name: name.slice(0, 120),
      url,
      format: 'yml',
      is_active: body.is_active !== false,
      write_quantity: body.write_quantity !== false,
      default_stock_when_available: Number(body.default_stock_when_available) || 10,
      source_kind: 'url',
      auto_add_items: body.auto_add_items === true,
      notify_out_of_stock: body.notify_out_of_stock !== false,
      default_markup_percent:
        body.default_markup_percent != null && body.default_markup_percent !== ''
          ? Number(body.default_markup_percent)
          : null,
    } as never)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'feed_already_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ feed: data }, { status: 201 })
}
