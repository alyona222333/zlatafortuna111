'use client'

/**
 * «Постачальники та наявність».
 *
 * Дві речі на одній сторінці, бо вони — дві половини одного процесу:
 *   ліворуч — звідки беремо СПИСОК товарів (експорт нашого сайту),
 *   праворуч — звідки беремо НАЯВНІСТЬ (прайси постачальників).
 *
 * Розносити їх по різних екранах означало б, що людина вперше налаштовує
 * склад і не бачить, чому після імпорту всюди стоїть «немає в прайсі».
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Plus, RefreshCw, Trash2, Upload, AlertCircle, Check, X, Link2, FileSpreadsheet,
  BellRing, PackageX, PackageCheck, Ban, FileUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { importSiteCsvFile, runWarehouseSync, type ImportProgress, type SyncProgress } from '@/lib/warehouse-client'

interface Alert {
  id: string
  kind: 'out_of_stock' | 'back_in_stock' | 'dropped'
  item_name: string | null
  sku: string | null
  supplier_name: string | null
  created_at: string
}

interface Feed {
  id: string
  name: string
  url: string | null
  source_kind: string
  file_name: string | null
  auto_add_items: boolean
  notify_out_of_stock: boolean
  default_markup_percent: number | null
  is_active: boolean
  write_quantity: boolean
  default_stock_when_available: number
  last_synced_at: string | null
  last_status: string | null
  last_error: string | null
  last_offers_count: number
  last_matched_count: number
  last_matched_offers_count: number
}

interface Overview {
  total_items: number
  site_items: number
  matched_items: number
  in_stock_items: number
  out_of_stock_items: number
  unmatched_items: number
  last_checked_at: string | null
}

interface SupplierOffer {
  id: string
  vendor_code: string | null
  name: string | null
  price: number | null
  old_price: number | null
  retail_price: number | null
  wholesale_price: number | null
  available: boolean
  stock_quantity: number | null
  url: string | null
  picture: string | null
  feed_name: string
  already_imported: boolean
}

interface OfferStats {
  total_offers: number
  imported_in_catalog: number
  available_to_add: number
}

export function SuppliersView() {
  const t = useTranslations('warehouse')

  function errorMessage(code: string | undefined, fallback?: string): string {
    const key = code ? `errors.${code}` : ''
    if (key && t.has(key)) return t(key)
    return fallback || code || t('errors.bulkFailed')
  }

  const [feeds, setFeeds] = useState<Feed[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const newAutoAdd = false

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unread, setUnread] = useState(0)

  const [fileSupplierName, setFileSupplierName] = useState('')
  const [fileAutoAdd, setFileAutoAdd] = useState(true)
  const [fileMarkup, setFileMarkup] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const priceFileRef = useRef<HTMLInputElement>(null)

  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [skipVariations, setSkipVariations] = useState(false)
  const [onlyPublished, setOnlyPublished] = useState(true)
  // Повний експорт сайту є джерелом істини: те, чого в ньому немає,
  // має перейти до «Прибрані», інакше видалені товари залишаються в складі.
  const [archiveMissing, setArchiveMissing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [offers, setOffers] = useState<SupplierOffer[]>([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [offerQuery, setOfferQuery] = useState('')
  const [offerBusy, setOfferBusy] = useState<string | null>(null)
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null)
  const [offerDraft, setOfferDraft] = useState<Record<string, string>>({})
  const [offerStats, setOfferStats] = useState<OfferStats>({ total_offers: 0, imported_in_catalog: 0, available_to_add: 0 })
  const [offerSku, setOfferSku] = useState('')
  const [offerFeedId, setOfferFeedId] = useState<string>('')
  const offersSectionRef = useRef<HTMLElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/feeds')
      if (!res.ok) throw new Error(t('errors.loadFailed'))
      const data = await res.json()
      setFeeds(data.feeds ?? [])
      setOverview(data.overview ?? null)
      setCanManage(!!data.can_manage_feeds)

      // Журнал подій доступний лише керівнику; 403 для решти — очікувана
      // відповідь, а не помилка, яку варто показувати на пів-екрана.
      const alertsRes = await fetch('/api/suppliers/alerts?limit=50')
      if (alertsRes.ok) {
        const a = await alertsRes.json()
        setAlerts(a.alerts ?? [])
        setUnread(a.unread ?? 0)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  async function loadOffers(feedId = offerFeedId) {
    setOffersLoading(true)
    try {
      const params = new URLSearchParams({ q: offerQuery })
      if (feedId) params.set('feed_id', feedId)
      const res = await fetch(`/api/inventory/offers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setOffers(data.offers ?? [])
        setOfferStats({ total_offers: data.total_offers ?? 0, imported_in_catalog: data.imported_in_catalog ?? 0, available_to_add: data.available_to_add ?? 0 })
      }
    } finally { setOffersLoading(false) }
  }

  async function addOffer(offer: SupplierOffer) {
    setOfferBusy(offer.id)
    try {
      const res = await fetch('/api/inventory/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer_id: offer.id, ...offerDraft }) })
      if (!res.ok) throw new Error('Не вдалося додати пропозицію')
      setNotice(`Додано до складу: ${offer.name ?? offer.vendor_code}`)
      await loadOffers()
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setOfferBusy(null) }
  }

  async function addOfferBySku() {
    const sku = offerSku.trim()
    if (!sku) return
    setOfferBusy('sku')
    setError(null)
    try {
      const res = await fetch('/api/inventory/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku, feed_id: offerFeedId || undefined }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Не вдалося знайти SKU у прайсах')
      if (data.offers?.length) throw new Error(`Знайдено кілька оферів для SKU: ${data.offers.map((o: { sku: string }) => o.sku).join(', ')}`)
      setOfferSku('')
      setNotice(`Товар додано до складу та поставлено на відстеження: ${sku}`)
      await loadOffers()
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setOfferBusy(null) }
  }

  function selectOfferFeed(feedId: string) {
    setOfferFeedId(feedId)
    setOfferQuery('')
    void loadOffers(feedId)
  }

  async function addFeed() {
    if (!newName.trim() || !newUrl.trim()) return
    setBusy('add')
    setError(null)
    try {
      const res = await fetch('/api/inventory/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, url: newUrl, auto_add_items: newAutoAdd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(errorMessage(data.error, data.message))
      setNewName('')
      setNewUrl('')
      setNotice(t('feeds.added'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function patchFeed(id: string, patch: Partial<Feed>) {
    setBusy(id)
    try {
      await fetch(`/api/inventory/feeds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function removeFeed(id: string, name: string) {
    if (!window.confirm(t('feeds.confirmDelete', { name }))) return
    setBusy(id)
    try {
      await fetch(`/api/inventory/feeds/${id}`, { method: 'DELETE' })
      setNotice(t('feeds.deleted'))
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function sync(feedId?: string) {
    setBusy(feedId ?? 'sync')
    setError(null)
    setNotice(null)
    setSyncProgress(null)
    try {
      // Список активних постачальників — з нього ж і беремо, кого саме
      // качати. Один конкретний прайс (кнопка біля картки) — це список
      // з одного елемента, той самий код без розгалужень.
      const targets = feedId
        ? feeds.filter((f) => f.id === feedId && f.is_active).map(({ id, name, url }) => ({ id, name, url }))
        : feeds.filter((f) => f.is_active).map(({ id, name, url }) => ({ id, name, url }))

      const report = await runWarehouseSync(targets, (p) => setSyncProgress(p))

      setNotice(t('sync.done', {
        matched: report.matched ?? 0,
        inStock: report.in_stock ?? 0,
        unmatched: report.unmatched ?? 0,
      }))
      const failed = report.feeds.filter((f) => f.status === 'error')
      if (failed.length) {
        setError(t('errors.someFeedsFailed', { names: failed.map((f) => f.name).join(', ') }))
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
      setSyncProgress(null)
    }
  }

  async function importSite(file: File) {
    setImporting(true)
    setError(null)
    setNotice(null)
    setImportProgress(null)
    try {
      // Розбір файлу і сам запис ідуть дрібними порціями з браузера —
      // жоден окремий запит на сервер не встигає впертись у 10–26-секундний
      // ліміт Netlify, який обривав це одним великим запитом раніше.
      const result = await importSiteCsvFile(
        file,
        { skipVariations, onlyPublished, archiveMissing },
        (p) => setImportProgress(p),
      )
      setNotice(t('import.done', {
        created: result.created,
        updated: result.updated,
        archived: result.archived,
        skipped: result.skipped,
      }))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
      setImportProgress(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function clearSiteProducts() {
    if (!window.confirm(t('import.confirmClear'))) return
    setBusy('clear-site')
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/inventory/site-import/clear', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errorMessage(data.error, data.message))
      setNotice(t('import.cleared', { count: data.deleted ?? 0 }))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function uploadPriceFile(file: File) {
    setUploadingFile(true)
    setError(null)
    setNotice(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (fileSupplierName.trim()) fd.append('name', fileSupplierName.trim())
      fd.append('auto_add', String(fileAutoAdd))
      if (fileMarkup.trim()) fd.append('markup', fileMarkup.trim())

      const res = await fetch('/api/suppliers/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(errorMessage(data.error, data.message))

      setNotice(t('priceFile.done', {
        offers: data.offers ?? 0,
        added: data.report?.added_items ?? 0,
        outOfStock: data.report?.went_out_of_stock ?? 0,
      }))
      setFileSupplierName('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploadingFile(false)
      if (priceFileRef.current) priceFileRef.current.value = ''
    }
  }

  async function markAlertsRead(ids?: string[]) {
    await fetch('/api/suppliers/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : { all: true }),
    })
    await load()
  }

  const fmtDate = (v: string | null) =>
    v ? new Date(v).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }) : '—'

  return (
    <div className="space-y-6">
      {notice && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          <Check className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label={t('dismiss')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label={t('dismiss')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Що змінилось у постачальників */}
      {alerts.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <BellRing className="w-5 h-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">{t('alerts.title')}</h2>
              {unread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-xs font-semibold">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAlertsRead()}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                {t('alerts.markAllRead')}
              </button>
            )}
          </div>
          <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {alerts.map((a) => {
              const Icon = a.kind === 'out_of_stock' ? PackageX
                : a.kind === 'back_in_stock' ? PackageCheck : Ban
              const tone = a.kind === 'out_of_stock' ? 'text-red-600'
                : a.kind === 'back_in_stock' ? 'text-green-700' : 'text-amber-600'
              return (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-900">
                      {t(`alerts.kind.${a.kind}`, { name: a.item_name ?? '—' })}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {[a.sku, a.supplier_name, fmtDate(a.created_at)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button
                    onClick={() => markAlertsRead([a.id])}
                    className="text-gray-300 hover:text-gray-600 shrink-0"
                    aria-label={t('alerts.markRead')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Стан складу */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {([
            ['siteItems', overview.site_items, 'text-gray-900'],
            ['matched', overview.matched_items, 'text-gray-900'],
            ['inStock', overview.in_stock_items, 'text-green-700'],
            ['outOfStock', overview.out_of_stock_items, 'text-red-600'],
            ['unmatched', overview.unmatched_items, 'text-amber-600'],
          ] as const).map(([key, value, color]) => (
            <div key={key} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className={`text-2xl font-semibold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t(`overview.${key}`)}</div>
            </div>
          ))}
        </div>
      )}

      {/* 1. Список товарів із сайту */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-1">
          <FileSpreadsheet className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-gray-900">{t('import.title')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t('import.description')}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {([
            ['onlyPublished', onlyPublished, setOnlyPublished],
            ['skipVariations', skipVariations, setSkipVariations],
            ['archiveMissing', archiveMissing, setArchiveMissing],
          ] as const).map(([key, value, setter]) => (
            <label key={key} className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setter(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-green-600"
              />
              <span>
                {t(`import.options.${key}`)}
                <span className="block text-xs text-gray-400">{t(`import.options.${key}Hint`)}</span>
              </span>
            </label>
          ))}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importSite(f)
          }}
        />
        <Button
          className="mt-4"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
        >
          <Upload className="w-4 h-4 mr-1.5" />
          {importing ? t('import.running') : t('import.action')}
        </Button>
        <Button
          className="mt-4 ml-2"
          size="sm"
          variant="outline"
          onClick={clearSiteProducts}
          disabled={importing || busy === 'clear-site'}
        >
          <Trash2 className="w-4 h-4 mr-1.5 text-red-600" />
          {busy === 'clear-site' ? t('import.clearing') : t('import.clearAction')}
        </Button>
        {importProgress && (
          <div className="mt-3">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all"
                style={{ width: `${Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {t('import.progress', { done: importProgress.done, total: importProgress.total })}
            </div>
          </div>
        )}
      </section>

      {/* Дані постачальників надходять за посиланнями */}
      {false && canManage && (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-1">
            <FileUp className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold text-gray-900">{t('priceFile.title')}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t('priceFile.description')}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              value={fileSupplierName}
              onChange={(e) => setFileSupplierName(e.target.value)}
              placeholder={t('feeds.namePlaceholder')}
              className="sm:w-56 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              value={fileMarkup}
              onChange={(e) => setFileMarkup(e.target.value)}
              inputMode="decimal"
              placeholder={t('priceFile.markupPlaceholder')}
              className="sm:w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <label className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer mt-3">
            <input
              type="checkbox"
              checked={fileAutoAdd}
              onChange={(e) => setFileAutoAdd(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-green-600"
            />
            <span>
              {t('priceFile.autoAdd')}
              <span className="block text-xs text-gray-400">{t('priceFile.autoAddHint')}</span>
            </span>
          </label>

          <input
            ref={priceFileRef}
            type="file"
            accept=".xml,.yml,.csv,.tsv,text/xml,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadPriceFile(f)
            }}
          />
          <Button
            className="mt-4"
            size="sm"
            onClick={() => priceFileRef.current?.click()}
            disabled={uploadingFile}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            {uploadingFile ? t('priceFile.running') : t('priceFile.action')}
          </Button>
        </section>
      )}

      {/* 2. Прайси постачальників */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <Link2 className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold text-gray-900">{t('feeds.title')}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t('feeds.description')}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" variant="outline" onClick={() => sync()} disabled={busy === 'sync'}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${busy === 'sync' ? 'animate-spin' : ''}`} />
              {busy === 'sync' ? t('sync.running') : t('sync.actionAll')}
            </Button>
            {syncProgress && busy === 'sync' && (
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

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">{t('loading')}</div>
        ) : feeds.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">{t('feeds.empty')}</div>
        ) : (
          <div className="space-y-3">
            {feeds.map((feed) => (
              <div key={feed.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{feed.name}</span>
                      {feed.last_status === 'ok' && <Badge variant="success">{t('feeds.statusOk')}</Badge>}
                      {feed.last_status === 'error' && <Badge variant="destructive">{t('feeds.statusError')}</Badge>}
                      {!feed.is_active && <Badge variant="secondary">{t('feeds.disabled')}</Badge>}
                      {feed.source_kind === 'file' && <Badge variant="outline">{t('feeds.fromFile')}</Badge>}
                    </div>
                    {feed.url ? (
                      <a
                        href={feed.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-gray-400 hover:text-green-700 mt-1 truncate"
                      >
                        {feed.url}
                      </a>
                    ) : (
                      <div className="text-xs text-gray-400 mt-1 truncate">{feed.file_name ?? '—'}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                      <div>У файлі постачальника: <span className="font-medium text-gray-700">{feed.last_offers_count}</span></div>
                      <div>Вигружено до магазину: <span className="font-medium text-gray-700">{feed.last_matched_offers_count}</span></div>
                      <div>На вибір для магазину: <span className="font-medium text-gray-700">{Math.max(0, feed.last_offers_count - feed.last_matched_offers_count)}</span></div>
                      <div>Остання відповідь: {fmtDate(feed.last_synced_at)}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => {
                        selectOfferFeed(feed.id)
                        offersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                    >
                      Обрати товари для магазину
                    </Button>
                    {feed.last_error && (
                      <div className="text-xs text-red-600 mt-1">{feed.last_error}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sync(feed.id)}
                      disabled={busy === feed.id}
                    >
                      <RefreshCw className={`w-4 h-4 ${busy === feed.id ? 'animate-spin' : ''}`} />
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => patchFeed(feed.id, { is_active: !feed.is_active })}
                          disabled={busy === feed.id}
                        >
                          {feed.is_active ? t('feeds.turnOff') : t('feeds.turnOn')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeFeed(feed.id, feed.name)}
                          disabled={busy === feed.id}
                          aria-label={t('feeds.delete')}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    {([
                      ['writeQuantity', feed.write_quantity, (v: boolean) => patchFeed(feed.id, { write_quantity: v })],
                      ['notify', feed.notify_out_of_stock, (v: boolean) => patchFeed(feed.id, { notify_out_of_stock: v })],
                    ] as const).map(([key, value, onChange]) => (
                      <label key={key} className="flex items-start gap-2.5 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => onChange(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-green-600"
                        />
                        <span>{t(`feeds.${key}`)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('feeds.namePlaceholder')}
                className="sm:w-56 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://…/products_feed.xml"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              <Button size="sm" onClick={addFeed} disabled={busy === 'add' || !newName.trim() || !newUrl.trim()}>
                <Plus className="w-4 h-4 mr-1.5" />
                {t('feeds.add')}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-3">Нові товари з цього джерела автоматично не додаються. Їх можна вибрати окремо в розділі «Пропозиції».</p>
          </div>
        )}
      </section>

      <section ref={offersSectionRef} className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-gray-900">Пропозиції постачальників</h2>
            <p className="text-sm text-gray-500">Позиції з прайсів, які можна додати до каталогу вручну. Додавання автоматично вмикає відстеження SKU.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadOffers()} disabled={offersLoading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${offersLoading ? 'animate-spin' : ''}`} />
            {offersLoading ? 'Завантаження…' : 'Оновити пропозиції'}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 text-sm">
          <div className="rounded-lg border bg-gray-50 px-3 py-2"><div className="text-xs text-gray-500">У файлі постачальника</div><div className="font-semibold">{offerStats.total_offers}</div></div>
          <div className="rounded-lg border bg-gray-50 px-3 py-2"><div className="text-xs text-gray-500">Вигружено до магазину</div><div className="font-semibold">{offerStats.imported_in_catalog}</div></div>
          <div className="rounded-lg border bg-gray-50 px-3 py-2"><div className="text-xs text-gray-500">На вибір для магазину</div><div className="font-semibold">{offerStats.available_to_add}</div></div>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={offerSku} onChange={(e) => setOfferSku(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addOfferBySku() }} placeholder="Введіть SKU для додавання" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <Button size="sm" onClick={addOfferBySku} disabled={offerBusy === 'sku' || !offerSku.trim()}>Додати за SKU</Button>
        </div>
        <div className="flex gap-2 mb-4">
          <select value={offerFeedId} onChange={(e) => selectOfferFeed(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Оберіть постачальника</option>
            {feeds.map((feed) => <option key={feed.id} value={feed.id}>{feed.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={offerQuery} onChange={(e) => setOfferQuery(e.target.value)} placeholder="Пошук за SKU або назвою" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <Button size="sm" onClick={() => loadOffers()}>Знайти</Button>
        </div>
        {offers.length === 0 ? <div className="py-6 text-center text-sm text-gray-400">Натисніть «Оновити пропозиції» після синхронізації прайсів.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-xs text-gray-500"><th className="text-left py-2">Товар / SKU</th><th className="text-left py-2">Постачальник</th><th className="text-right py-2">Опт</th><th className="text-right py-2">РРЦ</th><th className="text-right py-2">Залишок</th><th className="py-2" /></tr></thead>
              <tbody>{offers.filter((o) => !o.already_imported).map((offer) => (
                <tr key={offer.id} className="border-b last:border-0">
                  <td className="py-3"><button className="font-medium text-left hover:text-green-700" onClick={() => { setExpandedOffer(expandedOffer === offer.id ? null : offer.id); setOfferDraft({ name: offer.name ?? '', sell_price: String(offer.retail_price ?? offer.old_price ?? offer.price ?? ''), dropship_price: String(offer.retail_price ?? offer.price ?? ''), description: '' }) }}>{offer.name ?? 'Без назви'}</button><div className="text-xs text-gray-400">{offer.vendor_code ?? '—'}</div></td>
                  <td className="py-3 text-gray-500">{offer.feed_name}</td>
                  <td className="py-3 text-right">{offer.wholesale_price ?? offer.price ?? '—'}</td>
                  <td className="py-3 text-right">{offer.retail_price ?? offer.old_price ?? '—'}</td>
                  <td className="py-3 text-right">{offer.stock_quantity ?? (offer.available ? 'є' : 0)}</td>
                  <td className="py-3 text-right"><Button size="sm" onClick={() => addOffer(offer)} disabled={offerBusy === offer.id}>Додати до складу</Button></td>
                </tr>
              )).flatMap((row, index) => {
                const offer = offers.filter((o) => !o.already_imported)[index]
                return expandedOffer === offer?.id ? [row, <tr key={`${offer.id}-edit`}><td colSpan={6} className="bg-gray-50 p-3"><div className="grid md:grid-cols-3 gap-2"><input value={offerDraft.name ?? ''} onChange={(e) => setOfferDraft((d) => ({ ...d, name: e.target.value }))} className="border rounded px-2 py-1" placeholder="Назва" /><input value={offerDraft.sell_price ?? ''} onChange={(e) => setOfferDraft((d) => ({ ...d, sell_price: e.target.value }))} className="border rounded px-2 py-1" placeholder="Ціна сайту" /><input value={offerDraft.dropship_price ?? ''} onChange={(e) => setOfferDraft((d) => ({ ...d, dropship_price: e.target.value }))} className="border rounded px-2 py-1" placeholder="Опт дропшипера" /><textarea value={offerDraft.description ?? ''} onChange={(e) => setOfferDraft((d) => ({ ...d, description: e.target.value }))} className="border rounded px-2 py-1 md:col-span-3" placeholder="Опис" /></div></td></tr>] : [row]
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
