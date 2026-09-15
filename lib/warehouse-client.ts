/**
 * Клієнтський оркестратор для «Постачальників».
 *
 * Обидва процеси нижче свідомо керуються з БРАУЗЕРА дрібними запитами,
 * а не одним великим викликом на сервері. Причина одна й та сама:
 * Netlify обриває серверну функцію через 10–26 секунд, а розбір
 * 19 МБ CSV / завантаження чотирьох зовнішніх XML-прайсів довше цього.
 * У браузера такого обмеження немає — тому важка частина (розбір файлу,
 * послідовність кроків) відбувається тут, а кожен запит на сервер
 * лишається маленьким і швидким.
 */

import { parseSiteExportCsv } from './woocommerce-csv'
import type { FeedSyncReport, MatchReport } from './warehouse-sync'

/* -------------------------------------------------------------- *
 * Імпорт списку товарів сайту
 * -------------------------------------------------------------- */

export interface ImportProgress {
  done: number
  total: number
}

export interface ImportOutcome {
  created: number
  updated: number
  skipped: number
  archived: number
}

const IMPORT_BATCH_SIZE = 400

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? `request_failed_${res.status}`)
  }
  return data as T
}

export async function importSiteCsvFile(
  file: File,
  opts: { skipVariations: boolean; onlyPublished: boolean; archiveMissing: boolean },
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportOutcome> {
  const text = await file.text()

  // Розбір відбувається в браузері — тут немає таймаута взагалі, тож
  // навіть кілька секунд на 19 МБ файл не ризикують нічим обірватись.
  const { items, skippedRows } = parseSiteExportCsv(text, {
    skipVariations: opts.skipVariations,
    onlyPublished: opts.onlyPublished,
  })
  if (!items.length) {
    throw new Error('name_column_not_found_or_empty')
  }

  const runStartedAt = new Date().toISOString()
  let created = 0
  let updated = 0
  let skipped = skippedRows

  onProgress?.({ done: 0, total: items.length })

  for (let i = 0; i < items.length; i += IMPORT_BATCH_SIZE) {
    const slice = items.slice(i, i + IMPORT_BATCH_SIZE)
    const result = await postJson<{ created: number; updated: number; skipped: number }>(
      '/api/inventory/site-import/batch',
      { items: slice },
    )
    created += result.created
    updated += result.updated
    skipped += result.skipped
    onProgress?.({ done: Math.min(i + slice.length, items.length), total: items.length })
  }

  let archived = 0
  if (opts.archiveMissing) {
    const result = await postJson<{ archived: number }>('/api/inventory/site-import/finalize', {
      run_started_at: runStartedAt,
    })
    archived = result.archived
  }

  return { created, updated, skipped, archived }
}

/* -------------------------------------------------------------- *
 * Синхронізація з прайсами постачальників
 * -------------------------------------------------------------- */

export interface SyncProgress {
  stage: 'feeds' | 'matching'
  feedIndex?: number
  feedCount?: number
  feedName?: string
}

export interface SyncOutcome extends MatchReport {
  feeds: FeedSyncReport[]
}

/**
 * Проганяє синхронізацію крок за кроком: спершу по черзі якщо один
 * прайс — окремим коротким запитом на кожного активного постачальника,
 * потім один запит на звірку. Якщо переданий `feedId`, якщо він єдиний —
 * якщо треба оновити лише одного постачальника (кнопка біля картки).
 */
export async function runWarehouseSync(
  activeFeeds: { id: string; name: string }[],
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncOutcome> {
  const feeds: FeedSyncReport[] = []

  for (let i = 0; i < activeFeeds.length; i++) {
    const feed = activeFeeds[i]
    onProgress?.({ stage: 'feeds', feedIndex: i, feedCount: activeFeeds.length, feedName: feed.name })
    try {
      const report = await postJson<FeedSyncReport>(
        `/api/inventory/feeds/${feed.id}/fetch-offers`,
        {},
      )
      feeds.push(report)
    } catch (e) {
      feeds.push({
        feed_id: feed.id,
        name: feed.name,
        url: null,
        status: 'error',
        offers: 0,
        skipped: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  onProgress?.({ stage: 'matching' })
  const match = await postJson<MatchReport>('/api/inventory/feeds/match', {})

  return { feeds, ...match }
}
