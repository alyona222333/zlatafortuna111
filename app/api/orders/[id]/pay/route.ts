import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildLiqPayCheckout } from '@/lib/liqpay'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: order } = await supabase
    .from('orders')
    .select('id, business_id, customer_name, total_amount, currency')
    .eq('id', id)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data: business } = await supabase
    .from('businesses')
    .select('liqpay_public_key, liqpay_private_key')
    .eq('id', order.business_id)
    .maybeSingle()

  const bizKeys = business as { liqpay_public_key?: string | null; liqpay_private_key?: string | null } | null
  if (!bizKeys?.liqpay_public_key || !bizKeys?.liqpay_private_key) {
    return NextResponse.json({ error: 'LiqPay не підключено — додайте ключі в Замовлення → Підключити сайт' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  // A fresh liqpay order_id per attempt (LiqPay requires it unique per
  // payment request) while still tracing back to our order via prefix.
  const liqpayOrderId = `order-${order.id}-${Date.now()}`

  const checkout = buildLiqPayCheckout({
    publicKey: bizKeys.liqpay_public_key,
    privateKey: bizKeys.liqpay_private_key,
    amount: Number(order.total_amount),
    currency: order.currency || 'UAH',
    description: `Замовлення ${order.customer_name}`,
    orderId: liqpayOrderId,
    resultUrl: `${baseUrl}/orders`,
    serverUrl: `${baseUrl}/api/liqpay/callback`,
  })

  await supabase
    .from('orders')
    .update({ liqpay_order_id: liqpayOrderId, payment_status: 'pending' } as never)
    .eq('id', id)

  return NextResponse.json(checkout)
}
