import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_FIELDS = ['woocommerce_webhook_secret', 'woocommerce_url', 'nova_poshta_api_key', 'liqpay_public_key', 'liqpay_private_key'] as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { businessId } = body
  if (!businessId) {
    return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  // Back-compat: the orders page still sends { secret } for the WooCommerce key.
  if (body.secret) patch.woocommerce_webhook_secret = body.secret
  for (const key of ALLOWED_FIELDS) {
    if (key in body) patch[key] = body[key]
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  // RLS restricts this update to a business the caller owns or works at
  // (tenant_access_businesses); a shared webhook secret / API key is fine
  // for any linked staff to rotate.
  const { error } = await supabase.from('businesses').update(patch as never).eq('id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
