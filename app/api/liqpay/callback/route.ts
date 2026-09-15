import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyLiqPaySignature, decodeLiqPayData } from '@/lib/liqpay'

/**
 * LiqPay calls this URL directly (not from the customer's browser) after a
 * payment attempt finishes. It posts `data` (base64 JSON) and `signature`
 * as form fields. We don't know which business this is for until we
 * decode `data` and look up the order_id we generated, then verify the
 * signature using THAT business's own private key (each tenant has their
 * own LiqPay account/keys).
 */
export async function POST(request: Request) {
  const form = await request.formData()
  const data = form.get('data')?.toString()
  const signature = form.get('signature')?.toString()
  if (!data || !signature) {
    return NextResponse.json({ error: 'Missing data/signature' }, { status: 400 })
  }

  const admin = createServiceClient()
  const payload = decodeLiqPayData(data)
  const liqpayOrderId = String(payload.order_id ?? '')

  const { data: order } = await admin
    .from('orders')
    .select('id, business_id')
    .eq('liqpay_order_id', liqpayOrderId)
    .maybeSingle()

  if (!order) {
    // Could be a stale/duplicate callback for an order we've since changed —
    // acknowledge so LiqPay stops retrying, but do nothing.
    return NextResponse.json({ ok: true })
  }

  const { data: business } = await admin
    .from('businesses')
    .select('liqpay_private_key')
    .eq('id', order.business_id)
    .maybeSingle()

  const privateKey = (business as { liqpay_private_key?: string | null } | null)?.liqpay_private_key
  if (!privateKey || !verifyLiqPaySignature(data, signature, privateKey)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const status = String(payload.status ?? '')
  const isPaid = status === 'success' || status === 'sandbox'
  const isFailed = status === 'failure' || status === 'error'

  await admin
    .from('orders')
    .update({
      payment_status: isPaid ? 'paid' : isFailed ? 'failed' : 'pending',
      paid_at: isPaid ? new Date().toISOString() : null,
    } as never)
    .eq('id', order.id)

  return NextResponse.json({ ok: true })
}
