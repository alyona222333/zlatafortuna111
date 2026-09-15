import { readFileSync } from 'node:fs'
import { parseSiteExportCsv } from '../lib/woocommerce-csv'

const csv = readFileSync(new URL('../data/site-export.csv', import.meta.url), 'utf8')
const { items } = parseSiteExportCsv(csv, { onlyPublished: true })
const wanted = new Set(['M-1013-C10', 'M-120N-C106', 'M-120N-C107', 'M-120N-C109'])
const actual = items.filter((item) => item.sku && wanted.has(item.sku))

if (actual.length !== wanted.size) throw new Error(`Expected ${wanted.size} problem SKUs, got ${actual.length}`)
for (const item of actual) {
  if (!item.name || item.name === ` - ${item.sku!.split('-').pop()?.toLowerCase()}`) {
    throw new Error(`Technical variation name was not replaced for ${item.sku}: ${item.name}`)
  }
  if (item.regular_price == null) throw new Error(`Missing regular price for ${item.sku}`)
  if (!item.attributes || !item.attributes.toLowerCase().includes(item.sku!.split('-').pop()!.toLowerCase())) {
    throw new Error(`Missing variation attribute for ${item.sku}`)
  }
}
console.log(`OK: ${actual.length} problem variations retain SKU, price, name fallback and parameters`)
console.log(actual.map((item) => ({ sku: item.sku, name: item.name, price: item.sell_price, attributes: item.attributes })))
