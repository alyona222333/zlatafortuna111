'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Search, ChevronLeft, ChevronRight, ExternalLink, Trash2, X, Check, AlertCircle, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Item {
  id: string; name: string; sku: string | null; category: string | null; unit: string
  quantity: number; low_stock_threshold: number; sell_price: number | null
  external_id: string | null; product_url: string | null; image_url: string | null
  description: string | null; long_description: string | null
  site_regular_price: number | null; site_sale_price: number | null
  site_short_description: string | null; site_attributes: string | null; is_archived: boolean
}
type Filter = 'all' | 'in_stock' | 'out_of_stock'
type BulkAction = 'delete'
const PER_PAGE = 50
interface Props { currency: string; initialFilter?: string }

export function WarehouseTable({ currency, initialFilter }: Props) {
  const t = useTranslations('warehouse')
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0); const [hasMore, setHasMore] = useState(false); const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>(() => {
    const allowed: Filter[] = ['all', 'in_stock', 'out_of_stock']
    return allowed.includes(initialFilter as Filter) ? initialFilter as Filter : 'all'
  })
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null); const [canEdit, setCanEdit] = useState(false); const [canDelete, setCanDelete] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => { const id = setTimeout(() => setDebouncedQuery(query), 350); return () => clearTimeout(id) }, [query])
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ q: debouncedQuery, filter, page: String(page), per_page: String(PER_PAGE) })
      const res = await fetch(`/api/inventory/items?${params}`)
      if (!res.ok) throw new Error(t('errors.loadFailed'))
      const data = await res.json(); setItems(data.items ?? []); setTotal(data.total ?? 0); setHasMore(!!data.has_more); setCanEdit(!!data.can_edit); setCanDelete(!!data.can_delete)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setLoading(false) }
  }, [debouncedQuery, filter, page, t])
  useEffect(() => { void load() }, [load])
  function changeFilter(next: Filter) { setFilter(next); setPage(1); setSelected(new Set()); setExpandedId(null) }
  function changeQuery(next: string) { setQuery(next); setPage(1); setSelected(new Set()); setExpandedId(null) }
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE), hasMore ? page + 1 : 1)
  const allOnPageSelected = items.length > 0 && items.every((i) => selected.has(i.id))
  function toggleAll() { setSelected((prev) => { const next = new Set(prev); if (allOnPageSelected) items.forEach((i) => next.delete(i.id)); else items.forEach((i) => next.add(i.id)); return next }) }
  function toggleOne(id: string) { setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  async function runBulk(action: BulkAction) {
    if (!selected.size) return
    if (action === 'delete' && !window.confirm(t('bulk.confirmDelete', { count: selected.size }))) return
    setNotice(null); setError(null)
    try {
      const res = await fetch('/api/inventory/items/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selected], action }) })
      const data = await res.json(); if (!res.ok) throw new Error(t('errors.bulkFailed'))
      setNotice(t(`bulk.done.${action}`, { count: data.affected ?? selected.size })); setSelected(new Set()); await load()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  const filters: Filter[] = ['all', 'in_stock', 'out_of_stock']

  return <>
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
      <div className="relative flex-1 max-w-md"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" /><input type="search" value={query} onChange={(e) => changeQuery(e.target.value)} placeholder={t('searchPlaceholder')} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white" /></div>
    </div>
    <div className="flex flex-wrap gap-1.5 mb-4">{filters.map((f) => <button key={f} onClick={() => changeFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === f ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>{t(`filters.${f}`)}</button>)}</div>
    {notice && <div className="mb-3 flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm"><Check className="w-4 h-4 shrink-0 mt-0.5" /><span className="flex-1">{notice}</span><button onClick={() => setNotice(null)} aria-label={t('dismiss')}><X className="w-4 h-4" /></button></div>}
    {error && <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span className="flex-1">{error}</span><button onClick={() => setError(null)} aria-label={t('dismiss')}><X className="w-4 h-4" /></button></div>}
    {selected.size > 0 && canEdit && <div className="mb-3 flex flex-wrap items-center gap-2 bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm"><span className="font-medium">{t('bulk.selected', { count: selected.size })}</span><div className="flex-1" />{canDelete && <button onClick={() => runBulk('delete')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-red-300 hover:bg-red-500/20"><Trash2 className="w-4 h-4" />{t('bulk.delete')}</button>}<button onClick={() => setSelected(new Set())} className="p-1.5 rounded-md hover:bg-white/10" aria-label={t('bulk.clear')}><X className="w-4 h-4" /></button></div>}

    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {loading && items.length === 0 ? <div className="py-16 text-center text-gray-400 text-sm">{t('loading')}</div> : items.length === 0 ? <div className="py-16 text-center text-gray-500 px-6"><div className="text-4xl mb-3">📦</div><div className="font-medium">{query ? t('empty.noMatch', { query }) : t('empty.heading')}</div><div className="text-sm mt-1">{query ? t('empty.noMatchHint') : t('empty.hint')}</div></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500"><th className="w-10 px-3 py-3"><input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} className="w-4 h-4 rounded border-gray-300 accent-green-600" aria-label={t('table.selectAll')} /></th><th className="text-left px-4 py-3 font-medium">{t('table.name')}</th><th className="text-left px-4 py-3 font-medium">{t('table.sku')}</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">{t('table.category')}</th><th className="text-center px-4 py-3 font-medium">{t('table.stock')}</th><th className="text-right px-4 py-3 font-medium">{t('table.sitePrice')}</th></tr></thead>
        <tbody>{items.map((item) => { const expanded = expandedId === item.id; return <>
          <tr key={item.id} onClick={() => setExpandedId(expanded ? null : item.id)} className={`border-b border-gray-100 hover:bg-green-50/30 cursor-pointer ${item.is_archived ? 'opacity-60' : ''}`}>
            <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-green-600" aria-label={item.name} /></td>
            <td className="px-4 py-3"><div className="flex items-center gap-1.5"><span className="text-gray-400">{expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span><span className="font-medium text-gray-900">{item.name}</span>{item.product_url && <a href={item.product_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-green-700" aria-label={t('table.openAtSite')}><ExternalLink className="w-3.5 h-3.5" /></a>}<Link href={`/inventory/${item.id}`} onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-green-700" aria-label={t('table.edit')} title={t('table.edit')}><Pencil className="w-3.5 h-3.5" /></Link></div>{item.site_short_description && <div className="text-xs text-gray-500 mt-1 max-w-xl truncate">{item.site_short_description}</div>}</td>
            <td className="px-4 py-3 text-gray-700 font-mono text-xs whitespace-nowrap">{item.sku || '—'}</td><td className="px-4 py-3 hidden md:table-cell text-gray-500">{item.category ?? '—'}</td><td className="px-4 py-3 text-center whitespace-nowrap"><span className={`font-medium ${item.quantity <= item.low_stock_threshold ? 'text-red-600' : 'text-gray-900'}`}>{item.quantity}</span><span className="text-xs text-gray-400 ml-1">{item.unit}</span></td><td className="px-4 py-3 text-right text-gray-700">{item.site_sale_price != null && item.site_regular_price != null && item.site_sale_price < item.site_regular_price ? <span className="inline-flex flex-col items-end"><span className="font-medium text-red-600">{formatCurrency(item.site_sale_price, currency)}</span><span className="text-xs text-gray-400 line-through">{formatCurrency(item.site_regular_price, currency)}</span></span> : item.site_regular_price != null ? formatCurrency(item.site_regular_price, currency) : item.sell_price != null ? formatCurrency(item.sell_price, currency) : '—'}</td>
          </tr>
          {expanded && <tr key={`${item.id}-details`} className="border-b border-gray-200 bg-gray-50/70"><td colSpan={6} className="px-12 py-4"><div className="grid md:grid-cols-[auto_1fr] gap-4">{item.image_url && <img src={item.image_url} alt="" className="w-24 h-24 rounded-lg object-cover border border-gray-200" />}<div className="space-y-2 text-sm"><div><span className="font-medium text-gray-500">{t('details.shortDescription')}:</span> {item.site_short_description || item.description || '—'}</div><div><span className="font-medium text-gray-500">{t('details.description')}:</span> {item.long_description || '—'}</div><div><span className="font-medium text-gray-500">{t('details.sizesColors')}:</span> {item.site_attributes || '—'}</div>{item.product_url && <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-700 hover:underline">{t('details.openOnSite')} <ExternalLink className="w-3.5 h-3.5" /></a>}</div></div></td></tr>}
        </> })}</tbody></table></div>}
    </div>
    {(total > PER_PAGE || hasMore || page > 1) && <div className="mt-4 flex items-center justify-between text-sm text-gray-500"><span>{t('pagination.range', { from: (page - 1) * PER_PAGE + 1, to: Math.min(page * PER_PAGE, total), total })}</span><div className="flex items-center gap-1"><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50" aria-label={t('pagination.prev')}><ChevronLeft className="w-4 h-4" /></button><span className="px-3">{t('pagination.page', { page, pageCount })}</span><button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={loading || (!hasMore && page >= pageCount)} className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50" aria-label={t('pagination.next')}><ChevronRight className="w-4 h-4" /></button></div></div>}
  </>
}
