'use client'

/**
 * Таблиця складу.
 *
 * Показує рівно те, що вивантажено на нашому сайті, а колонка «Наявність» —
 * з прайсів постачальників. Якщо товару немає в жодному прайсі, у колонці
 * стоїть «немає в прайсі», а не вигаданий нуль: краще чесна дірка, яку
 * менеджер побачить і закриє, ніж цифра, якій не можна вірити.
 *
 * Дані тягнуться сторінками по 50 — у каталозі близько десяти тисяч
 * позицій, і вантажити їх одним шматком на телефон немає сенсу.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, ExternalLink,
  Archive, ArchiveRestore, EyeOff, Eye, Trash2, X, Check, AlertCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { runWarehouseSync, type SyncProgress } from '@/lib/warehouse-client'
import { formatCurrency } from '@/lib/utils'

interface Item {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  category: string | null
  unit: string
  quantity: number
  low_stock_threshold: number
  sell_price: number | null
  source: string
  external_id: string | null
  product_url: string | null
  image_url: string | null
  description: string | null
  site_regular_price: number | null
  site_sale_price: number | null
  dropship_price: number | null
  site_short_description: string | null
  site_attributes: string | null
  track_supplier: boolean
  is_archived: boolean
  supplier_feed_id: string | null
  supplier_offer_id: string | null
  supplier_available: boolean | null
  supplier_stock: number | null
  supplier_price: number | null
  supplier_retail_price: number | null
  supplier_url: string | null
  supplier_match_type: string | null
  supplier_checked_at: string | null
}

type Filter = 'all' | 'in_stock' | 'out_of_stock' | 'unmatched' | 'untracked' | 'archived'
type BulkAction = 'archive' | 'restore' | 'untrack' | 'track' | 'delete'

const PER_PAGE = 50

interface Props {
  currency: string
  initialFilter?: string
}

export function WarehouseTable({ currency, initialFilter }: Props) {
  const t = useTranslations('warehouse')

  const [items, setItems] = useState<Item[]>([])
  const [feeds, setFeeds] = useState<{ id: string; name: string }[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState(initialFilter ?? '')
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)

  // Кожне натискання клавіші в пошуку не має ходити в базу; чекаємо
  // паузу, і скасовуємо попередній запит, щоб відповіді не переганяли
  // одна одну і не показували застарілу сторінку.
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 350)
    return () => clearTimeout(id)
  }, [query])

  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        q: debouncedQuery,
        filter,
        page: String(page),
        per_page: String(PER_PAGE),
      })
      const res = await fetch(`/api/inventory/items?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error(t('errors.loadFailed'))
      const data = await res.json()
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
      setFeeds(data.feeds ?? [])
      setCanEdit(!!data.can_edit)
      setCanDelete(!!data.can_delete)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [debouncedQuery, filter, page, t])

  useEffect(() => { load() }, [load])

  // Скидання сторінки живе в обробниках, а не в ефекті: інакше зміна
  // фільтра спершу вантажила б стару сторінку, а потім першу — два
  // запити і мигання таблиці на кожен клік.
  function changeFilter(next: Filter) {
    setFilter(next)
    setPage(1)
    setSelected(new Set())
  }

  function changeQuery(next: string) {
    setQuery(next)
    setPage(1)
    setSelected(new Set())
  }

  const feedName = useMemo(
    () => new Map(feeds.map((f) => [f.id, f.name])),
    [feeds],
  )

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE))
  const allOnPageSelected = items.length > 0 && items.every((i) => selected.has(i.id))

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) items.forEach((i) => next.delete(i.id))
      else items.forEach((i) => next.add(i.id))
      return next
    })
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runSync() {
    setSyncing(true)
    setNotice(null)
    setError(null)
    setSyncProgress(null)
    try {
      // Постачальники качаються по черзі окремими короткими запитами, а не
      // одним великим — інакше сервер обривається по таймауту хостингу
      // задовго до того, як встигне обробити всі чотири прайси й тисячі
      // товарів складу.
      const feedsRes = await fetch('/api/inventory/feeds')
      const feedsData = await feedsRes.json()
      const active = ((feedsData.feeds ?? []) as { id: string; name: string; is_active: boolean }[])
        .filter((f) => f.is_active)

      const report = await runWarehouseSync(active, (p) => setSyncProgress(p))

      setNotice(
        t('sync.done', {
          matched: report.matched ?? 0,
          inStock: report.in_stock ?? 0,
          unmatched: report.unmatched ?? 0,
        }),
      )
      const failed = report.feeds.filter((f) => f.status === 'error')
      if (failed.length) {
        setError(
          t('errors.someFeedsFailed', {
            names: failed.map((f) => f.name).join(', '),
          }),
        )
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
      setSyncProgress(null)
    }
  }

  async function runBulk(action: BulkAction) {
    if (!selected.size) return
    if (action === 'delete' && !window.confirm(t('bulk.confirmDelete', { count: selected.size }))) {
      return
    }
    setNotice(null)
    setError(null)
    try {
      const res = await fetch('/api/inventory/items/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected], action }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('[warehouse] bulk action failed:', data.error)
        throw new Error(t('errors.bulkFailed'))
      }
      setNotice(t(`bulk.done.${action}`, { count: data.affected ?? selected.size }))
      setSelected(new Set())
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const filters: Filter[] = ['all', 'in_stock', 'out_of_stock', 'unmatched', 'untracked', 'archived']

  return (
    <>
      {/* Пошук, фільтри, синхронізація */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white"
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={runSync} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? t('sync.running') : t('sync.action')}
            </Button>
            {canDelete && (
              <Link href="/suppliers">
                <Button size="sm" variant="outline">{t('suppliersLink')}</Button>
              </Link>
            )}
          </div>
          {syncProgress && syncing && (
            <div className="text-xs text-gray-400">
              {syncProgress.stage === 'feeds'
                ? t('sync.progressFeed', {
                    current: (syncProgress.feedIndex ?? 0) + 1,
                    total: syncProgress.feedCount ?? 0,
                    name: syncProgress.feedName ?? '',
                  })
                : t('sync.progressMatching')}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => changeFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {t(`filters.${f}`)}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mb-3 flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          <Check className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label={t('dismiss')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label={t('dismiss')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Панель масових дій */}
      {selected.size > 0 && canEdit && (
        <div className="mb-3 flex flex-wrap items-center gap-2 bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm">
          <span className="font-medium">{t('bulk.selected', { count: selected.size })}</span>
          <div className="flex-1" />
          {filter === 'archived' ? (
            <button onClick={() => runBulk('restore')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10">
              <ArchiveRestore className="w-4 h-4" /> {t('bulk.restore')}
            </button>
          ) : (
            <button onClick={() => runBulk('archive')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10">
              <Archive className="w-4 h-4" /> {t('bulk.archive')}
            </button>
          )}
          <button onClick={() => runBulk('untrack')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10">
            <EyeOff className="w-4 h-4" /> {t('bulk.untrack')}
          </button>
          <button onClick={() => runBulk('track')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10">
            <Eye className="w-4 h-4" /> {t('bulk.track')}
          </button>
          {canDelete && (
            <button onClick={() => runBulk('delete')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-red-300 hover:bg-red-500/20">
              <Trash2 className="w-4 h-4" /> {t('bulk.delete')}
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-md hover:bg-white/10" aria-label={t('bulk.clear')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Таблиця */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">{t('loading')}</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-500 px-6">
            {query ? (
              <>
                <div className="font-medium">{t('empty.noMatch', { query })}</div>
                <div className="text-sm mt-1">{t('empty.noMatchHint')}</div>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">📦</div>
                <div className="font-medium">{t('empty.heading')}</div>
                <div className="text-sm mt-1 text-gray-500">{t('empty.hint')}</div>
                {canDelete && (
                  <Link href="/suppliers" className="inline-block mt-3">
                    <Button size="sm">{t('empty.action')}</Button>
                  </Link>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 accent-green-600"
                      aria-label={t('table.selectAll')}
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium">{t('table.product')}</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">{t('table.category')}</th>
                  <th className="text-center px-4 py-3 font-medium">{t('table.availability')}</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">{t('table.stock')}</th>
                  <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">{t('table.sitePrice')}</th>
                  <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Опт дропшипера</th>
                  <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">РРЦ постачальника</th>
                  <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">{t('table.supplier')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const untracked = !item.track_supplier
                  const unmatched = !item.supplier_offer_id
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                        item.is_archived ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleOne(item.id)}
                          className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-green-600"
                          aria-label={item.name}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/inventory/${item.id}`} className="font-medium text-gray-900 hover:text-green-700">
                            {item.name}
                          </Link>
                          {item.product_url && (
                            <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-700" aria-label="Open product on site">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                          {item.sku && <span>{item.sku}</span>}
                          {item.site_attributes && <span>{item.site_attributes}</span>}
                          {item.source === 'site' && <span className="text-gray-400">{t('table.fromSite')}</span>}
                          {untracked && <span className="text-amber-600">{t('table.untracked')}</span>}
                        </div>
                        {item.site_short_description && (
                          <div className="text-xs text-gray-500 mt-1 max-w-xl truncate" title={item.site_short_description}>
                            {item.site_short_description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-500">{item.category ?? '—'}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {untracked ? (
                          <span className="text-xs text-gray-400">{t('status.manual')}</span>
                        ) : unmatched ? (
                          <Badge variant="warning">{t('status.notInFeed')}</Badge>
                        ) : item.supplier_available ? (
                          <Badge variant="success">{t('status.inStock')}</Badge>
                        ) : (
                          <Badge variant="destructive">{t('status.outOfStock')}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {item.supplier_stock != null ? (
                          <span className="font-medium text-gray-900">{item.supplier_stock}</span>
                        ) : (
                          <span className="text-gray-400">{item.quantity}</span>
                        )}
                        <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell text-gray-700">
                        {item.site_sale_price != null && item.site_regular_price != null && item.site_sale_price < item.site_regular_price ? (
                          <span className="inline-flex flex-col items-end">
                            <span className="font-medium text-red-600">{formatCurrency(item.site_sale_price, currency)}</span>
                            <span className="text-xs text-gray-400 line-through">{formatCurrency(item.site_regular_price, currency)}</span>
                          </span>
                        ) : item.sell_price != null ? formatCurrency(item.sell_price, currency) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell text-gray-700">
                        {item.dropship_price != null ? formatCurrency(item.dropship_price, currency) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell text-gray-500">
                        {item.supplier_retail_price != null ? formatCurrency(item.supplier_retail_price, currency) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-gray-500">
                        {item.supplier_feed_id ? (
                          <span className="inline-flex items-center gap-1.5">
                            {feedName.get(item.supplier_feed_id) ?? '—'}
                            {item.supplier_url && (
                              <a
                                href={item.supplier_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-green-700"
                                aria-label={t('table.openAtSupplier')}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Сторінки */}
      {total > PER_PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>{t('pagination.range', {
            from: (page - 1) * PER_PAGE + 1,
            to: Math.min(page * PER_PAGE, total),
            total,
          })}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50"
              aria-label={t('pagination.prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3">{t('pagination.page', { page, pageCount })}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount || loading}
              className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50"
              aria-label={t('pagination.next')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
