/**
 * Прайси постачальників (YML / Rozetka XML) — завантаження, розбір, звірка.
 *
 * Усі чотири посилання, які дав власник, — це один і той самий формат
 * `yml_catalog → shop → offers → offer`, просто віддані різними движками:
 *
 *   urbanshop.com.ua/products_feed.xml   (Хорошоп)
 *   rimari.ua/rozetka.xml                (вивантаження під Rozetka)
 *   luxyart.com.ua/products_feed.xml     (Хорошоп)
 *   domino-opt.com.ua/content/export/…   (Хорошоп)
 *
 * Тому окремий парсер на кожного постачальника не потрібен — потрібен один,
 * який терпимо ставиться до варіацій: наявність може приїхати як атрибут
 * `available`, як тег `<stock_quantity>`, `<quantity_in_stock>`, `<available>`
 * або як `<param name="Наличие">`. Артикул — як `<vendorCode>`, `<article>`,
 * `<param name="Артикул">` чи просто `id` оферу.
 *
 * Свідомо без npm-залежності на XML-парсер: структура `offer` плоска, а фіди
 * важать десятки мегабайт — DOM-парсер тримав би весь документ у памʼяті
 * обʼєктами. Тут — один прохід по рядку з вирізанням блоків `<offer>…</offer>`.
 */

export interface ParsedOffer {
  offer_id: string
  vendor_code: string | null
  barcode: string | null
  name: string | null
  price: number | null
  old_price: number | null
  retail_price: number | null
  wholesale_price: number | null
  currency: string | null
  available: boolean
  stock_quantity: number | null
  url: string | null
  picture: string | null
  vendor: string | null
  short_description: string | null
  description: string | null
}

export interface ParsedFeed {
  offers: ParsedOffer[]
  shopName: string | null
  /** Офери, які довелось пропустити (без id) — для діагностики в UI. */
  skipped: number
}

/* ------------------------------------------------------------------ *
 * Нормалізація артикулів
 * ------------------------------------------------------------------ */

// Візуально тотожні кириличні літери → латиниця. Постачальники масово
// плутають їх у артикулах («М2-1/2» кирилицею vs «M2-1/2» латиницею),
// і без цього збіг просто не знаходиться.
const CYR = 'АВЕКМНОРСТУХІЇЅ'
const LAT = 'ABEKMHOPCTYXIIS'

/**
 * Має бути ПОБІТОВО тим самим, що робить public.norm_article() у міграції 047.
 * Якщо міняєте тут — міняйте і там, інакше звірка почне давати різні
 * результати залежно від того, хто її рахував: Postgres чи Node.
 */
export function normArticle(value: string | null | undefined): string | null {
  if (!value) return null
  let s = String(value).toUpperCase()
  let out = ''
  for (const ch of s) {
    const idx = CYR.indexOf(ch)
    out += idx >= 0 ? LAT[idx] : ch
  }
  s = out.replace(/[^A-Z0-9]/g, '')
  return s.length ? s : null
}

export function normName(value: string | null | undefined): string | null {
  if (!value) return null
  const s = String(value).trim().toLowerCase().replace(/\s+/g, ' ')
  return s.length ? s : null
}

/** Коди моделей, які часто залишаються в назві, коли поле SKU на сайті порожнє. */
export function productCodes(value: string | null | undefined): string[] {
  if (!value) return []
  const raw = String(value).toUpperCase()
  const codes = raw.match(/[A-ZА-ЯІЇЄҐ]*\d[A-ZА-ЯІЇЄҐ0-9]*(?:[-/]\d[A-ZА-ЯІЇЄҐ0-9]*)*/g) ?? []
  return [...new Set(codes.map((code) => normArticle(code)).filter((code): code is string => !!code && code.length >= 4))]
}

/* ------------------------------------------------------------------ *
 * Розбір XML
 * ------------------------------------------------------------------ */

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&') // останнім, інакше подвійне декодування
}

function stripCdata(s: string): string {
  const m = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  return m ? m[1] : s
}

function textOf(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')
  const m = block.match(re)
  if (!m) return null
  const v = decodeEntities(stripCdata(m[1])).trim()
  return v.length ? v : null
}

/** Значення <param name="…">…</param> без урахування регістру назви. */
function paramOf(block: string, ...names: string[]): string | null {
  const re = /<param\s+[^>]*name\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/param>/gi
  const wanted = names.map((n) => n.toLowerCase())
  let m: RegExpExecArray | null
  while ((m = re.exec(block))) {
    if (wanted.includes(m[1].trim().toLowerCase())) {
      const v = decodeEntities(stripCdata(m[2])).trim()
      if (v.length) return v
    }
  }
  return null
}

function toNumber(v: string | null): number | null {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function firstText(block: string, tags: string[]): string | null {
  for (const tag of tags) {
    const value = textOf(block, tag)
    if (value) return value
  }
  return null
}

const TRUE_WORDS = new Set([
  'true', '1', 'yes', 'y',
  'в наличии', 'в наявності', 'є в наявності', 'есть', 'є', 'in stock', 'available',
  'под заказ', 'під замовлення', // умовно є: постачальник привезе
])
const FALSE_WORDS = new Set([
  'false', '0', 'no', 'n',
  'нет в наличии', 'немає в наявності', 'нет', 'немає', 'out of stock', 'not available',
  'закончился', 'закінчився', 'снят с производства',
])

function parseAvailability(raw: string | null): boolean | null {
  if (raw == null) return null
  const v = raw.trim().toLowerCase()
  if (TRUE_WORDS.has(v)) return true
  if (FALSE_WORDS.has(v)) return false
  return null
}

/**
 * Розбирає вміст фіда. Не кидає на кривому XML — краще віддати те, що
 * вдалось прочитати, і показати лічильник `skipped`, ніж завалити всю
 * синхронізацію через один зламаний офер у постачальника.
 */
export function parseYmlFeed(xml: string): ParsedFeed {
  const offers: ParsedOffer[] = []
  let skipped = 0

  const shopName = textOf(xml.slice(0, 20000), 'name')

  let cursor = 0
  for (;;) {
    const start = xml.indexOf('<offer', cursor)
    if (start === -1) break
    // Відсікаємо <offers>, <offer_id> тощо — після "<offer" має йти
    // пробіл або '>', інакше це інший тег.
    const after = xml[start + 6]
    if (after !== ' ' && after !== '>' && after !== '\n' && after !== '\r' && after !== '\t') {
      cursor = start + 6
      continue
    }

    const selfClose = xml.indexOf('/>', start)
    const end = xml.indexOf('</offer>', start)
    let block: string
    if (end === -1 && selfClose === -1) break
    if (end === -1 || (selfClose !== -1 && selfClose < end)) {
      block = xml.slice(start, selfClose + 2)
      cursor = selfClose + 2
    } else {
      block = xml.slice(start, end + 8)
      cursor = end + 8
    }

    const headMatch = block.match(/^<offer\b([^>]*)>/)
    const head = headMatch ? headMatch[1] : ''

    const idMatch = head.match(/\bid\s*=\s*["']([^"']+)["']/i)
    const offerId = idMatch ? idMatch[1].trim() : null
    if (!offerId) {
      skipped++
      continue
    }

    const availAttr = head.match(/\bavailable\s*=\s*["']([^"']*)["']/i)?.[1] ?? null
    const stockRaw =
      textOf(block, 'stock_quantity') ??
      textOf(block, 'quantity_in_stock') ??
      textOf(block, 'quantity') ??
      textOf(block, 'stock') ??
      textOf(block, 'stockQuantity') ??
      textOf(block, 'quantityInStock') ??
      paramOf(block, 'Количество', 'Кількість', 'Наявність кількість', 'Залишок', 'Stock', 'Quantity')
    const stock = toNumber(stockRaw)

    const availText =
      textOf(block, 'available') ??
      paramOf(block, 'Наличие', 'Наявність', 'Availability')

    // Пріоритет: явне число залишку → атрибут available → тег/param →
    // якщо нічого немає, вважаємо, що офер у фіді = товар продається.
    let available: boolean
    if (stock != null) available = stock > 0
    else {
      available =
        parseAvailability(availAttr) ??
        parseAvailability(availText) ??
        true
    }

    offers.push({
      offer_id: offerId,
      // У різних YML-експортах один і той самий SKU називається по-різному.
      // offer id — останній fallback: у Хорошоп він стабільний, навіть коли
      // vendorCode у фіді відсутній.
      vendor_code:
        firstText(block, ['vendorCode', 'vendor_code', 'article', 'article_number', 'sku', 'productCode', 'product_code', 'code']) ??
        paramOf(block, 'Артикул', 'Артикул товару', 'Артикул виробника', 'Код', 'Код товару', 'Article', 'SKU', 'Vendor code') ??
        offerId,
      barcode: textOf(block, 'barcode') ?? textOf(block, 'ean') ?? null,
      name: textOf(block, 'name') ?? textOf(block, 'model') ?? textOf(block, 'name_ua'),
      price: toNumber(textOf(block, 'price')),
      old_price: toNumber(textOf(block, 'oldprice') ?? textOf(block, 'price_old')),
      retail_price: toNumber(textOf(block, 'retail_price') ?? textOf(block, 'rrp') ?? textOf(block, 'recommendedRetailPrice') ?? paramOf(block, 'РРЦ', 'RRP', 'Роздрібна ціна', 'Розничная цена', 'Роздріб')),
      wholesale_price: toNumber(textOf(block, 'wholesale_price') ?? textOf(block, 'opt_price') ?? textOf(block, 'purchase_price') ?? paramOf(block, 'Опт', 'Оптова ціна', 'Оптовая цена', 'Wholesale', 'Закупівельна ціна')),
      currency: textOf(block, 'currencyId') ?? 'UAH',
      available,
      stock_quantity: stock,
      url: textOf(block, 'url'),
      picture: textOf(block, 'picture'),
      vendor: textOf(block, 'vendor'),
      short_description: textOf(block, 'short_description') ?? textOf(block, 'description_short'),
      description: textOf(block, 'description'),
    })
  }

  return { offers, shopName, skipped }
}

/* ------------------------------------------------------------------ *
 * Завантаження
 * ------------------------------------------------------------------ */

// Було 300_000 (5 хв) — Netlify вбиває саму функцію через 10–26с незалежно
// від коду, тому цей таймер у проді ніколи не встигав спрацювати: коли
// постачальник відповідає повільно, хостинг обриває процес ДО catch, і
// картка постачальника застигає на останньому вдалому статусі.
export const FEED_FETCH_TIMEOUT_MS = 20_000
const MAX_FEED_BYTES = 120 * 1024 * 1024

export async function fetchFeed(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        // Деякі движки віддають 403 на порожній UA.
        'User-Agent': 'ZlataFortuna-Warehouse/1.0 (+stock sync)',
        Accept: 'application/xml, text/xml, */*',
        'Accept-Encoding': 'gzip, deflate',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

    const categoryIds = new Set(
      (new URL(url).searchParams.get('group_ids') ?? new URL(url).searchParams.get('label_ids') ?? '')
        .split(',').map((id) => id.trim()).filter(Boolean),
    )
    const len = Number(res.headers.get('content-length') ?? 0)
    if (!categoryIds.size && len && len > MAX_FEED_BYTES) {
      throw new Error(`Файл завеликий (${Math.round(len / 1048576)} МБ). Додайте label_ids для фільтрації категорій.`)
    }

    // Великий YML LuxyArt ігнорує label_ids і все одно повертає близько 303 МБ.
    // Читаємо його потоком і залишаємо тільки offer з потрібним categoryId.
    // Если провайдер уже применил group_ids и ответ помещается в лимит,
    // не фильтруем его второй раз: некоторые YML-движки не гарантируют
    // categoryId внутри каждого offer после server-side фильтрации.
    if (categoryIds.size && len > MAX_FEED_BYTES && res.body) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let carry = ''
      const selected: string[] = []
      const take = (block: string) => {
        const category = block.match(/<categoryId>([\s\S]*?)<\/categoryId>/i)?.[1]?.trim()
        if (category && categoryIds.has(category)) selected.push(block)
      }
      while (true) {
        const part = await reader.read()
        carry += decoder.decode(part.value ?? new Uint8Array(), { stream: !part.done })
        let start = carry.search(/<offer\b/i)
        while (start >= 0) {
          const end = carry.search(/<\/offer>/i)
          if (end < 0 || end < start) {
            carry = carry.slice(start)
            break
          }
          take(carry.slice(start, end + '</offer>'.length))
          carry = carry.slice(end + '</offer>'.length)
          start = carry.search(/<offer\b/i)
        }
        if (part.done) break
      }
      if (!selected.length) throw new Error('У фільтрованій відповіді немає товарів за вказаними label_ids')
      return `<yml_catalog><shop><offers>${selected.join('')}</offers></shop></yml_catalog>`
    }

    const text = await res.text()
    if (!text.includes('<offer')) throw new Error('У відповіді немає жодного <offer> — перевірте посилання')
    return text
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ *
 * Звірка «товар сайту ↔ офер постачальника»
 * ------------------------------------------------------------------ */

export type MatchType = 'sku'

export interface MatchableItem {
  id: string
  sku: string | null
  barcode: string | null
  name: string
  product_url?: string | null
}

export interface MatchableOffer {
  id: string
  feed_id: string
  offer_id: string
  vendor_code: string | null
  barcode: string | null
  name: string | null
  price: number | null
  old_price?: number | null
  retail_price?: number | null
  wholesale_price?: number | null
  available: boolean
  stock_quantity: number | null
  url: string | null
  short_description?: string | null
  description?: string | null
}

export interface MatchResult {
  item_id: string
  offer: MatchableOffer
  match_type: MatchType
}

/**
 * Зводить список складу з кешем оферів. Порядок пріоритетів навмисний:
 *
 *   1. артикул (SKU ↔ vendorCode)  — єдиний по-справжньому надійний ключ;
 *   2. штрих-код                   — надійний, але постачальники рідко його дають;
 *   3. назва                       — тільки якщо назва унікальна з ОБОХ боків.
 *
 * Пункт 3 навмисно параноїдальний: у прайсах повно позицій з однаковою
 * назвою і різним розміром («Мереживний пеньюар» × S/M/L). Якщо назва
 * трапляється більше одного разу — збігу не буде взагалі, і товар піде
 * в «не знайдено», щоб менеджер звів його руками. Прописати не той
 * залишок гірше, ніж чесно показати «—».
 */
/**
 * Зводить список складу з кешем оферів СУВОРО за артикулом (SKU ↔
 * vendorCode), і тільки за ним. Резервний збіг за назвою товару свідомо
 * прибрано: назви на сайті регулярно переписують, і вони більше не
 * збігаються з назвами постачальника.
 *
 * MIN_SKU_LEN: короткі (1–3 символи) артикули не беруться до звірки
 * взагалі. Коли в прайсі постачальника немає власного поля «Артикул»,
 * parseYmlFeed чесно підставляє замість нього внутрішній `offer id` —
 * а це часто просто невелике число на кшталт «724». У різних
 * постачальників (навіть із геть різним асортиментом) внутрішня
 * нумерація незалежна, тому такі короткі псевдо-артикули регулярно
 * випадково збігаються, і товар одного постачальника хибно підклеюється
 * до товару іншого.
 */
const MIN_SKU_LEN = 4

export function matchItemsToOffers(
  items: MatchableItem[],
  offers: MatchableOffer[],
): { matches: MatchResult[]; unmatched: string[] } {
  const bySku = new Map<string, MatchableOffer>()

  for (const o of offers) {
    const sku = normArticle(o.vendor_code)
    if (!sku || sku.length < MIN_SKU_LEN) continue
    const prev = bySku.get(sku)
    // Той самий артикул у двох оферів: лишаємо той, де товар є в
    // наявності — менеджеру потрібно знати, що взяти можна.
    if (!prev || (!prev.available && o.available)) bySku.set(sku, o)
  }

  const matches: MatchResult[] = []
  const unmatched: string[] = []

  for (const it of items) {
    const sku = normArticle(it.sku)
    const hit = sku && sku.length >= MIN_SKU_LEN ? bySku.get(sku) : undefined
    if (hit) {
      matches.push({ item_id: it.id, offer: hit, match_type: 'sku' })
    } else {
      unmatched.push(it.id)
    }
  }

  return { matches, unmatched }
}
