/**
 * Розбір експорту товарів сайту (CSV з WooCommerce).
 *
 * Варіації WooCommerce часто містять у Name лише значення атрибута
 * (« - c10»), а повну назву — тільки у батьківського товару. Перед записом
 * будуємо індекси батьків і наслідуємо з них назву, категорію, опис, фото та
 * посилання, залишаючи SKU/ціну/параметри конкретної варіації.
 */

export interface SiteProduct {
  external_id: string | null
  sku: string | null
  barcode: string | null
  name: string
  category: string | null
  image_url: string | null
  product_url: string | null
  short_description: string | null
  long_description: string | null
  attributes: string | null
  regular_price: number | null
  sale_price: number | null
  sell_price: number | null
  quantity: number | null
  low_stock_threshold: number | null
}

export interface SiteExportParseResult {
  items: SiteProduct[]
  skippedRows: number
}

export interface SiteExportParseOptions {
  skipVariations?: boolean
  onlyPublished?: boolean
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === ',') { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

const HEADER_ALIASES: Record<string, string[]> = {
  external_id: ['id', 'ід', 'идентификатор'],
  type: ['type', 'тип'],
  sku: ['sku', 'артикул', 'код товару', 'код товара'],
  barcode: ['gtin, upc, ean, or isbn', 'barcode', 'штрихкод', 'штрих-код'],
  name: ['name', 'название', 'назва', 'товар'],
  published: ['published', 'опубликовано', 'опубліковано'],
  stock: ['stock', 'запас', 'залишок', 'остаток'],
  regular_price: ['regular price', 'обычная цена', 'звичайна ціна'],
  sale_price: ['sale price', 'цена со скидкой', 'ціна зі знижкою', 'акційна ціна'],
  categories: ['categories', 'категории', 'категорії'],
  images: ['images', 'изображения', 'зображення'],
  parent: ['parent', 'родитель', 'батьківський'],
  short_description: ['short description', 'краткое описание', 'короткий опис'],
  long_description: ['description', 'описание', 'опис', 'опис товару', 'довгий опис'],
  external_url: ['external url', 'url', 'посилання', 'ссылка'],
}

function buildHeaderMap(header: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  header.forEach((raw, idx) => {
    const h = raw.trim().toLowerCase()
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] === undefined && aliases.includes(h)) map[field] = idx
    }
    const attr = h.match(/^(?:attribute|атрибут|атрибуты)\s*(\d+)\s*(name|название|назва|value|значение|значення|value\(s\))?$/i)
    if (attr) {
      const n = attr[1]
      if (/value|значен/.test(attr[2] ?? '')) map[`attribute_${n}_value`] = idx
      else map[`attribute_${n}_name`] = idx
    }
  })
  return map
}

function num(v: string | undefined): number | null {
  if (!v) return null
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function clean(v: string | undefined, max: number): string | null {
  const s = (v ?? '').trim()
  return s ? s.slice(0, max) : null
}

function stripHtml(v: string | null): string | null {
  if (!v) return null
  const text = v.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 5000) : null
}

function categoryOf(raw: string | null): string | null {
  if (!raw) return null
  const first = raw.split(',')[0]
  const parts = first.split('>').map((p) => p.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1].slice(0, 100) : null
}

function imagesOf(raw: string | null): string | null {
  return raw ? raw.split(',')[0].trim().slice(0, 500) : null
}

function attrsOf(row: string[], map: Record<string, number>): string | null {
  const attrs: string[] = []
  for (let n = 1; n <= 3; n++) {
    const nameIdx = map[`attribute_${n}_name`]
    const valueIdx = map[`attribute_${n}_value`]
    if (nameIdx === undefined || valueIdx === undefined) continue
    const name = row[nameIdx]?.trim()
    const value = row[valueIdx]?.trim()
    if (name && value) attrs.push(`${name}: ${value}`)
  }
  return attrs.length ? attrs.join('; ').slice(0, 1000) : null
}

function skuGroup(value: string | null): string | null {
  if (!value) return null
  // У частині експортів WooCommerce Parent порожній, а SKU варіації має
  // вигляд M-120N-C106. Відкидаємо лише суфікс атрибута, не змінюючи сам SKU.
  const match = value.trim().match(/^(.+)-([a-zа-яіїєґ]+\d+)$/i)
  return match ? match[1].toLowerCase() : value.trim().toLowerCase()
}

function isTechnicalVariationName(value: string): boolean {
  return !value || /^[-—–]?\s*[a-zа-яіїєґ]+\d*\s*$/i.test(value)
}

function isInvalidCatalogName(value: string): boolean {
  const name = value.trim()
  if (!name) return true
  if (/^import\s+placeholder\b/i.test(name)) return true
  // SKU/code accidentally placed in the Name column: 9517839927-m,
  // 345/72-S, A12-XL. Such values are never product names in the site export.
  return /^[a-zа-яіїєґ0-9]+(?:[-_/][a-zа-яіїєґ0-9]+)+$/i.test(name)
}

export function parseSiteExportCsv(text: string, opts: SiteExportParseOptions = {}): SiteExportParseResult {
  const rows = parseCsv(text)
  if (rows.length < 2) return { items: [], skippedRows: 0 }
  const map = buildHeaderMap(rows[0])
  if (map.name === undefined) throw new Error('name_column_not_found')
  const get = (row: string[], field: string) => map[field] !== undefined ? row[map[field]] : undefined
  const rawRows: { row: string[]; type: string; id: string | null; sku: string | null; parent: string | null }[] = []
  let skippedRows = 0

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row.length || row.every((c) => !c.trim())) continue
    const name = clean(get(row, 'name'), 200)
    if (!name) { skippedRows++; continue }
    const type = (get(row, 'type') ?? '').trim().toLowerCase()
    if (opts.skipVariations && type === 'variation') { skippedRows++; continue }
    const published = (get(row, 'published') ?? '').trim()
    if (opts.onlyPublished && (published === '0' || published === '-1')) { skippedRows++; continue }
    rawRows.push({
      row,
      type,
      id: clean(get(row, 'external_id'), 64),
      sku: clean(get(row, 'sku'), 64),
      parent: clean(get(row, 'parent'), 128),
    })
  }

  const byId = new Map<string, typeof rawRows[number]>()
  const bySku = new Map<string, typeof rawRows[number]>()
  const bySkuGroup = new Map<string, typeof rawRows[number]>()
  for (const raw of rawRows) {
    if (raw.id) byId.set(raw.id, raw)
    if (raw.sku) bySku.set(raw.sku.toLowerCase(), raw)
    const group = skuGroup(raw.sku)
    const candidateName = clean(get(raw.row, 'name'), 200) ?? ''
    // Перевага рядку з реальною назвою товару над технічним «- c10».
    if (group && !isTechnicalVariationName(candidateName)) {
      const previous = bySkuGroup.get(group)
      if (!previous || isTechnicalVariationName(clean(get(previous.row, 'name'), 200) ?? '')) {
        bySkuGroup.set(group, raw)
      }
    }
  }

  function parentFor(raw: typeof rawRows[number]) {
    if (raw.type !== 'variation') return null
    if (raw.parent && (byId.get(raw.parent) || bySku.get(raw.parent.toLowerCase()))) {
      return byId.get(raw.parent) ?? bySku.get(raw.parent.toLowerCase()) ?? null
    }
    // У цьому експорті колонка Parent порожня. WooCommerce додає до SKU
    // варіації суфікс на кшталт -C10, тому шукаємо найдовший SKU-батько.
    if (raw.sku) {
      const parts = raw.sku.split('-')
      for (let i = parts.length - 1; i > 0; i--) {
        const candidate = parts.slice(0, i).join('-').toLowerCase()
        const hit = bySku.get(candidate)
        if (hit && hit.type !== 'variation') return hit
      }
    }
    return null
  }

  const items: SiteProduct[] = []
  for (const raw of rawRows) {
    const row = raw.row
    const parent = parentFor(raw)
    const ownName = clean(get(row, 'name'), 200) ?? ''
    const inferredParent = raw.type === 'variation' && !parent
      ? bySkuGroup.get(skuGroup(raw.sku) ?? '') ?? null
      : null
    const parentRow = parent ?? inferredParent
    const parentName = parentRow ? clean(get(parentRow.row, 'name'), 200) : null
    // The warehouse name must be traceable to the site export. Do not replace
    // a technical variation name with the SKU: when WooCommerce exports a
    // variation without its parent row, the SKU is not a product name and
    // makes the warehouse list look like a catalogue of codes. If a parent
    // exists, inherit its real product name; otherwise keep the source name.
    const name = parentRow && raw.type === 'variation'
      ? (parentName ?? ownName)
      : ownName
    // Если WooCommerce не прислал родительскую строку, техническое имя
    // вариации нельзя показывать менеджеру и нельзя заменять SKU. Такую
    // строку пропускаем до повторной выгрузки с корректным Parent.
    if (isInvalidCatalogName(name) || isTechnicalVariationName(name)) {
      skippedRows++
      continue
    }
    const ownRegular = num(get(row, 'regular_price'))
    const ownSale = num(get(row, 'sale_price'))
    const regular = ownRegular ?? (parentRow ? num(get(parentRow.row, 'regular_price')) : null)
    const sale = ownSale ?? (parentRow ? num(get(parentRow.row, 'sale_price')) : null)
    const ownShort = stripHtml(clean(get(row, 'short_description'), 5000))
    const ownLong = stripHtml(clean(get(row, 'long_description'), 20000))
    const ownCategory = categoryOf(clean(get(row, 'categories'), 300))
    const ownImage = imagesOf(clean(get(row, 'images'), 2000))
    const ownUrl = clean(get(row, 'external_url'), 1000)
    const ownAttributes = attrsOf(row, map)
    const variationLabel = isTechnicalVariationName(ownName) ? ownName.replace(/^[-—–]\s*/, '').trim() : null
    const attributes = [ownAttributes, variationLabel && !ownAttributes?.includes(variationLabel) ? `Варіант: ${variationLabel}` : null]
      .filter(Boolean).join('; ') || null
    items.push({
      external_id: raw.id,
      sku: raw.sku,
      barcode: clean(get(row, 'barcode'), 64),
      name,
      category: ownCategory ?? (parentRow ? categoryOf(clean(get(parentRow.row, 'categories'), 300)) : null),
      image_url: ownImage ?? (parentRow ? imagesOf(clean(get(parentRow.row, 'images'), 2000)) : null),
      product_url: ownUrl ?? (parentRow ? clean(get(parentRow.row, 'external_url'), 1000) : null),
      short_description: ownShort ?? (parentRow ? stripHtml(clean(get(parentRow.row, 'short_description'), 5000)) : null),
      long_description: ownLong ?? (parentRow ? stripHtml(clean(get(parentRow.row, 'long_description'), 20000)) : null),
      attributes,
      regular_price: regular,
      sale_price: sale,
      sell_price: sale ?? regular,
      quantity: num(get(row, 'stock')),
      low_stock_threshold: num(get(row, 'low_stock')),
    })
  }
  return { items, skippedRows }
}
