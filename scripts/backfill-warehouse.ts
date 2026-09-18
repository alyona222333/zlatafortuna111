#!/usr/bin/env -S npx tsx
/**
 * Одноразовий (і повторюваний) бекфіл складу.
 *
 * Бере CSV-вигрузку сайту й чотири прайси постачальників, які власник
 * дав прямим текстом у розмові 15.09.2026 — і одразу пише все в базу,
 * без єдиного кліку в інтерфейсі. Це те саме, що робить кнопка
 * «Завантажити файл сайту» + «Оновити всі» на сторінці «Постачальники»,
 * просто одним запуском: викликає ту саму бібліотеку
 * (lib/woocommerce-csv.ts, lib/warehouse-site-import.ts, lib/warehouse-sync.ts),
 * що й сам сайт, тож результат гарантовано той самий.
 *
 * Працює через SERVICE ROLE ключ — обходить RLS. Запускати тільки з
 * довіреного середовища (свій комп'ютер, сервер деплою), ніколи з
 * браузера і ніколи не комітити ключ у git.
 *
 * ЗАПУСК:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *     npx tsx scripts/backfill-warehouse.ts [шлях/до/export.csv]
 *
 * Обидві змінні є в Supabase → Project Settings → API. Якщо шлях до CSV
 * не вказано — використовується вбудований data/site-export.csv (та сама
 * вигрузка, яку власник надіслав у чаті).
 *
 * Скрипт ідемпотентний: товари звіряються за WooCommerce ID/артикулом,
 * постачальники — за URL, тож повторний запуск лише оновлює дані, а не
 * плодить дублі.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSiteExportCsv } from '../lib/woocommerce-csv'
import { importSiteProducts } from '../lib/warehouse-site-import'
import { syncWarehouse } from '../lib/warehouse-sync'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Чотири посилання, які власник дав у розмові. Формат — стандартний
 * yml_catalog/offers, той самий, що розбирає lib/supplier-feeds.ts.
 */
const DEFAULT_SUPPLIER_FEEDS: { name: string; url: string }[] = [
  {
    name: 'Urban Shop',
    url: 'https://urbanshop.com.ua/products_feed.xml?hash_tag=c673a8a6e076c676116ec9b839805840&sales_notes=&product_ids=&label_ids=12173073%2C145314888%2C12173048%2C144671648%2C12173064%2C12173071&exclude_fields=&html_description=0&yandex_cpa=&process_presence_sure=&languages=uk&extra_fields=&group_ids=',
  },
  { name: 'Rimari', url: 'https://rimari.ua/rozetka.xml' },
  {
    name: 'LuxyArt',
    url: 'https://luxyart.com.ua/products_feed.xml?hash_tag=af134bea6ccc922a41a940a0e10daaec&sales_notes=&product_ids=&label_ids=&exclude_fields=&html_description=1&yandex_cpa=&process_presence_sure=&languages=uk%2Cru&extra_fields=&group_ids=',
  },
  {
    name: 'Domino opt',
    url: 'https://domino-opt.com.ua/content/export/f946570ac063e4af6c4f0e4e12fa6d86.xml',
  },
]

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    fail(
      'Потрібні змінні середовища NEXT_PUBLIC_SUPABASE_URL і ' +
      'SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API).',
    )
  }

  const csvPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.join(__dirname, '..', 'data', 'site-export.csv')

  console.log(`Читаю файл сайту: ${csvPath}`)
  let csvText: string
  try {
    csvText = readFileSync(csvPath, 'utf-8')
  } catch {
    fail(`Не вдалося прочитати файл: ${csvPath}`)
  }

  const supabase = createClient(supabaseUrl!, serviceKey!)

  // Самостійний застосунок веде один бізнес на інстанс — беремо
  // найстарший рядок, так само як getBusinessForOwner() на сайті.
  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (bizErr) fail(`Помилка читання businesses: ${bizErr.message}`)
  if (!business) fail('У базі ще немає жодного бізнесу — спершу пройдіть онбординг на сайті.')

  console.log(`Бізнес: ${business.name} (${business.id})\n`)

  // ---------- 1. Список товарів сайту → склад ----------
  console.log('── Крок 1/3: список товарів сайту ──')
  const parsed = parseSiteExportCsv(csvText, { skipVariations: true, onlyPublished: true })
  console.log(`У файлі: ${parsed.items.length} товарів (пропущено рядків: ${parsed.skippedRows})`)

  const siteResult = await importSiteProducts(supabase, business.id, parsed.items, {
    skippedFromParsing: parsed.skippedRows,
  })
  console.log(
    `Склад: додано ${siteResult.created}, оновлено ${siteResult.updated}, ` +
    `пропущено ${siteResult.skipped}\n`,
  )

  // ---------- 2. Прайси постачальників ----------
  console.log('── Крок 2/3: прайси постачальників ──')
  for (const feed of DEFAULT_SUPPLIER_FEEDS) {
    const { data: existing } = await supabase
      .from('supplier_feeds')
      .select('id')
      .eq('business_id', business.id)
      .eq('url', feed.url)
      .maybeSingle()

    if (existing) {
      console.log(`— ${feed.name}: вже додано`)
      continue
    }

    const { error } = await supabase.from('supplier_feeds').insert({
      business_id: business.id,
      name: feed.name,
      url: feed.url,
      format: 'yml',
      source_kind: 'url',
      is_active: true,
      write_quantity: true,
      default_stock_when_available: 10,
    } as never)

    if (error) console.error(`— ${feed.name}: НЕ додано (${error.message})`)
    else console.log(`— ${feed.name}: додано`)
  }
  console.log()

  // ---------- 3. Завантаження прайсів і звірка по артикулу ----------
  console.log('── Крок 3/3: завантажую прайси і звіряю з артикулами (може зайняти кілька хвилин) ──')
  const report = await syncWarehouse(supabase, business.id)

  console.log('\nРезультат по кожному прайсу:')
  for (const f of report.feeds) {
    if (f.status === 'error') {
      console.log(`  ✗ ${f.name}: ${f.error}`)
    } else {
      console.log(`  ✓ ${f.name}: ${f.offers} пропозицій`)
    }
  }

  console.log('\nПідсумок:')
  console.log(`  Товарів звірено:        ${report.items_checked}`)
  console.log(`  Знайдено в прайсах:     ${report.matched}`)
  console.log(`  З них є в наявності:    ${report.in_stock}`)
  console.log(`  З них немає в наявності:${report.out_of_stock}`)
  console.log(`  Не знайдено в прайсах:  ${report.unmatched}`)

  console.log('\n✓ Готово. Відкрийте «Склад» — наявність і ціни постачальників уже там.\n')
}

main().catch((e) => {
  console.error('\n✗ Несподівана помилка:', e instanceof Error ? e.message : e)
  process.exit(1)
})
