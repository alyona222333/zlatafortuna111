import { readFileSync } from 'node:fs'
import { parseSiteExportCsv } from '../lib/woocommerce-csv'

const csv = readFileSync(new URL('../data/site-export.csv', import.meta.url), 'utf8')
const { items } = parseSiteExportCsv(csv, { onlyPublished: true })
if (items.some((item) => /^import placeholder\b/i.test(item.name))) {
  throw new Error('Import placeholder must not be imported as a product name')
}
if (items.some((item) => /^[a-zа-яіїєґ0-9]+(?:[-_/][a-zа-яіїєґ0-9]+)+$/i.test(item.name))) {
  throw new Error('SKU-like values must not be imported as product names')
}
const technical = items.filter((item) => item.name.startsWith('-'))
if (technical.length) throw new Error(`Technical variation names must be skipped: ${technical.map((i) => i.sku).join(', ')}`)
console.log(`OK: ${items.length} imported products have real catalog names; technical variations are skipped`)
