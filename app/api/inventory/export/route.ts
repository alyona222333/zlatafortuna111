import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /["\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function xmlEscape(value: unknown): string {
  const text = value == null ? '' : String(value)
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const EXPORT_COLUMNS: Record<string, { label: string; get: (item: any) => unknown }> = {
  sku: { label: 'SKU', get: (i) => i.sku ?? '' },
  barcode: { label: 'GTIN, UPC, EAN, or ISBN', get: (i) => i.barcode ?? '' },
  name: { label: 'Name', get: (i) => i.name },
  short_description: { label: 'Short description', get: (i) => i.site_short_description ?? '' },
  description: { label: 'Description', get: (i) => i.long_description ?? i.site_short_description ?? '' },
  stock: { label: 'Stock', get: (i) => i.quantity ?? 0 },
  sale_price: { label: 'Sale price', get: (i) => i.site_sale_price ?? '' },
  regular_price: { label: 'Regular price', get: (i) => i.site_regular_price ?? i.sell_price ?? '' },
  category: { label: 'Categories', get: (i) => i.category ?? '' },
  images: { label: 'Images', get: (i) => i.image_url ?? '' },
  url: { label: 'External URL', get: (i) => i.product_url ?? '' },
  attributes: { label: 'Attribute 1 value(s)', get: (i) => i.site_attributes ?? '' },
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const format = (req.nextUrl.searchParams.get('format') ?? 'csv').toLowerCase() === 'xml' ? 'xml' : 'csv'
  const requested = (req.nextUrl.searchParams.get('columns') ?? '').split(',').filter((key) => EXPORT_COLUMNS[key])
  const keys = requested.length ? requested : Object.keys(EXPORT_COLUMNS)
  const { data: items, error } = await (supabase.from('inventory_items')
    .select('external_id,name,sku,barcode,category,quantity,site_regular_price,site_sale_price,sell_price,site_short_description,long_description,site_attributes,image_url,product_url')
    .eq('business_id', business.id).eq('is_archived', false).order('name') as any)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const date = new Date().toISOString().slice(0, 10)

  if (format === 'xml') {
    // YML (yml_catalog/shop/offers) — той самий формат, який ми читаємо з
    // прайсів постачальників (lib/supplier-feeds.ts), тож цей файл можна
    // віддати як власний фід — наприклад, дропшиперу.
    const offersXml = (items ?? []).map((item: any) => {
      const price = item.site_sale_price ?? item.site_regular_price ?? item.sell_price ?? ''
      const oldPrice = item.site_sale_price != null && item.site_regular_price != null && item.site_sale_price < item.site_regular_price
        ? item.site_regular_price
        : null
      const parts = [
        `  <offer id="${xmlEscape(item.external_id ?? item.sku ?? '')}" available="${item.quantity > 0 ? 'true' : 'false'}">`,
        item.sku ? `    <vendorCode>${xmlEscape(item.sku)}</vendorCode>` : null,
        `    <name>${xmlEscape(item.name)}</name>`,
        price !== '' ? `    <price>${xmlEscape(price)}</price>` : null,
        oldPrice != null ? `    <oldprice>${xmlEscape(oldPrice)}</oldprice>` : null,
        `    <currencyId>UAH</currencyId>`,
        item.category ? `    <categoryId>${xmlEscape(item.category)}</categoryId>` : null,
        item.image_url ? `    <picture>${xmlEscape(item.image_url)}</picture>` : null,
        item.product_url ? `    <url>${xmlEscape(item.product_url)}</url>` : null,
        `    <stock_quantity>${xmlEscape(item.quantity ?? 0)}</stock_quantity>`,
        (item.site_short_description ?? item.long_description) ? `    <description>${xmlEscape(item.site_short_description ?? item.long_description)}</description>` : null,
        `  </offer>`,
      ].filter(Boolean)
      return parts.join('\n')
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<yml_catalog date="${date}">\n<shop>\n<offers>\n${offersXml}\n</offers>\n</shop>\n</yml_catalog>\n`
    const filename = `pronto-feed-${date}.xml`
    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` } })
  }

  // Supplier wholesale/RRP/dropship fields are intentionally not in EXPORT_COLUMNS.
  const headers = ['ID', 'Type', ...keys.map((key) => EXPORT_COLUMNS[key].label), 'Published']
  const rows = (items ?? []).map((item: any) => [item.external_id ?? '', 'simple', ...keys.map((key) => EXPORT_COLUMNS[key].get(item)), '1'])
  const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
  const filename = `pronto-woocommerce-${date}.csv`
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` } })
}
