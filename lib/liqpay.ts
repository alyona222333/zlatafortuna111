import crypto from 'crypto'

/**
 * Minimal LiqPay integration — no SDK needed, LiqPay's whole API is just
 * "base64 JSON params + a SHA1 signature of privateKey+params+privateKey".
 * https://www.liqpay.ua/documentation/api/aquiring/checkout/doc
 */

export interface LiqPayCheckoutParams {
  publicKey: string
  privateKey: string
  amount: number
  currency: string // 'UAH'
  description: string
  orderId: string // our own orders.id or a composite string — must be unique per payment attempt
  resultUrl: string   // where the customer's browser returns to after paying
  serverUrl: string   // LiqPay calls this in the background to confirm payment
}

export function buildLiqPayCheckout(params: LiqPayCheckoutParams) {
  const payload = {
    public_key: params.publicKey,
    version: '3',
    action: 'pay',
    amount: params.amount,
    currency: params.currency,
    description: params.description,
    order_id: params.orderId,
    result_url: params.resultUrl,
    server_url: params.serverUrl,
  }

  const data = Buffer.from(JSON.stringify(payload)).toString('base64')
  const signature = crypto
    .createHash('sha1')
    .update(params.privateKey + data + params.privateKey)
    .digest('base64')

  // Posting this data+signature pair to https://www.liqpay.ua/api/3/checkout
  // (as a simple HTML form, or redirecting via LiqPay's checkout widget)
  // takes the customer to the actual payment page.
  return { data, signature, checkoutUrl: 'https://www.liqpay.ua/api/3/checkout' }
}

export function verifyLiqPaySignature(data: string, signature: string, privateKey: string): boolean {
  const expected = crypto.createHash('sha1').update(privateKey + data + privateKey).digest('base64')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function decodeLiqPayData(data: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
}
