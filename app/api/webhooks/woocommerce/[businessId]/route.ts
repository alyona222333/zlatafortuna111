import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * WooCommerce -> CRM order sync.
 *
 * Setup on the WooCommerce side (WordPress admin):
 *   WooCommerce -> Settings -> Advanced -> Webhooks -> Add webhook
 *     Topic:      Order created  (add a second webhook for "Order updated" too)
 *     Delivery URL: https://<your-crm-domain>/api/webhooks/woocommerce/<businessId>
 *     Secret:     paste the same value stored in Settings -> (Delivery/WooCommerce) in the CRM
 *     API version: WP REST API Integration v3
 *
 * <businessId> is this business's id (visible in the CRM's own Settings page,
 * or ask support). The secret is compared against WooCommerce's
 * X-WC-Webhook-Signature header (HMAC-SHA256, base64) to make sure the
 * request really came from your store and not from someone who guessed
 * the URL.
 */

function decodeItems(lineItems: unknown): Array<{ name: string; qty: number; price: number }> {
  if (!Array.isArray(lineItems)) return []
  return lineItems.map((li) => {
    const item = li as Record<string, unknown>
    return {
      name: String(item.name ?? 'Товар'),
      qty: Number(item.quantity ?? 1),
      price: Number(item.price ?? item.total ?? 0),
    }
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const rawBody = await request.text()

  const admin = createServiceClient()
  const { data: business } = await admin
    .from('businesses')
    .select('id, woocommerce_webhook_secret')
    .eq('id', businessId)
    .maybeSingle()

  if (!business) {
    return NextResponse.json({ error: 'Unknown business' }, { status: 404 })
  }

  const signature = request.headers.get('x-wc-webhook-signature')
  if (business.woocommerce_webhook_secret) {
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }
    const expected = crypto
      .createHmac('sha256', business.woocommerce_webhook_secret)
      .update(rawBody, 'utf8')
      .digest('base64')
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }
  // If no secret is configured yet, the webhook is accepted unverified —
  // fine for initial testing, but set the secret in Settings before going live.

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // WooCommerce sends an empty {} ping when a webhook is first created — just acknowledge it.
  if (!payload || Object.keys(payload).length === 0 || payload.id === undefined) {
    return NextResponse.json({ ok: true, ping: true })
  }

  const billing = (payload.billing ?? {}) as Record<string, unknown>
  const shipping = (payload.shipping ?? {}) as Record<string, unknown>

  const customerName = [billing.first_name, billing.last_name].filter(Boolean).join(' ').trim() || 'Клієнт з сайту'
  const customerPhone = (billing.phone as string) || null
  const customerEmail = (billing.email as string) || null

  const deliveryCity = (shipping.city as string) || (billing.city as string) || null
  const deliveryAddress = [shipping.address_1, shipping.address_2].filter(Boolean).join(', ') || null

  const externalOrderId = String(payload.id)
  const items = decodeItems(payload.line_items)
  const total = Number(payload.total ?? 0)

  // De-duplicate: WooCommerce retries webhooks on failure, and "order
  // updated" events reuse the same id — upsert instead of always inserting.
  const { data: existing } = await admin
    .from('orders')
    .select('id')
    .eq('business_id', businessId)
    .eq('external_source', 'woocommerce')
    .eq('external_order_id', externalOrderId)
    .maybeSingle()

  const row = {
    business_id: businessId,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    source: 'woocommerce',
    items,
    total_amount: total,
    currency: (payload.currency as string) ?? 'UAH',
    delivery_method: 'courier',
    delivery_city: deliveryCity,
    delivery_address: deliveryAddress,
    status: 'new',
    external_order_id: externalOrderId,
    external_source: 'woocommerce',
  }

  if (existing) {
    await admin.from('orders').update(row).eq('id', existing.id)
  } else {
    await admin.from('orders').insert(row)
  }

  return NextResponse.json({ ok: true })
}
