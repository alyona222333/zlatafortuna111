'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Item { id: string; name: string; sku: string | null; quantity: number; unit: string }
interface Movement { id: string; item_id: string; type: string; quantity: number; note: string | null; created_at: string; inventory_items?: { name?: string; sku?: string | null; unit?: string } | null }

type Operation = 'purchase' | 'return' | 'transfer' | 'stocktaking'
const labelKeys: Record<Operation, { title: string; action: string; hint: string }> = {
  purchase: { title: 'operationPurchase', action: 'actionPurchase', hint: 'hintPurchase' }, return: { title: 'operationReturn', action: 'actionReturn', hint: 'hintReturn' }, transfer: { title: 'operationTransfer', action: 'actionTransfer', hint: 'hintTransfer' }, stocktaking: { title: 'operationStocktaking', action: 'actionStocktaking', hint: 'hintStocktaking' },
}

export function InventoryOperationView({ operation, items, initialMovements }: { operation: Operation; items: Item[]; initialMovements: Movement[] }) {
  const [itemId, setItemId] = useState(items[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [actual, setActual] = useState('')
  const [note, setNote] = useState('')
  const [orderReference, setOrderReference] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [from, setFrom] = useState('Основний склад')
  const [to, setTo] = useState('')
  const [movements, setMovements] = useState(initialMovements)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const t = useTranslations('newModules'); const meta = labelKeys[operation]

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMessage(''); setSaving(true)
    const res = await fetch('/api/inventory/movements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: itemId, operation, quantity: Number(quantity), actual_quantity: Number(actual), note, from_location: from, to_location: to, order_reference: orderReference, payment_method: paymentMethod }) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setMessage(data.error === 'quantity_exceeds_stock' ? t('insufficient') : data.error ?? t('noRecords')); return }
    setMessage(t('operationSaved', { quantity: data.quantity })); setQuantity(''); setActual(''); setNote(''); setOrderReference(''); setPaymentMethod(''); setTo('')
    window.location.reload()
  }

  return <div className="space-y-6">
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><h2 className="font-semibold text-blue-900">{t(meta.title)}</h2><p className="mt-1 text-sm text-blue-800">{t(meta.hint)}</p></div>
    {items.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">{t('addProductFirst')}</div> : <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 max-w-2xl">
      <label className="block text-sm font-medium text-gray-700">{t('item')}<select value={itemId} onChange={e => setItemId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2">{items.map(i => <option key={i.id} value={i.id}>{i.name} · {t('quantity').toLowerCase()} {i.quantity} {i.unit}</option>)}</select></label>
      {operation === 'stocktaking' ? <label className="block text-sm font-medium text-gray-700">{t('actualQuantity')}<input required min="0" type="number" step="0.001" value={actual} onChange={e => setActual(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" /></label> : <label className="block text-sm font-medium text-gray-700">{t('quantity')}<input required min="0.001" type="number" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" /></label>}
      {operation === 'transfer' && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">{t('from')}<input required value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" /></label><label className="text-sm font-medium text-gray-700">{t('to')}<input required value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" /></label></div>}
      {operation === 'return' && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">Номер замовлення<input value={orderReference} onChange={e => setOrderReference(e.target.value)} placeholder="№ замовлення або ТТН" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" /></label><label className="text-sm font-medium text-gray-700">Спосіб оплати<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"><option value="">Оберіть спосіб</option><option value="card">Картка / онлайн</option><option value="наложенный платеж">Наложений платіж</option><option value="cash">Готівка</option></select></label></div>}
      <label className="block text-sm font-medium text-gray-700">{t('note')}<input value={note} onChange={e => setNote(e.target.value)} placeholder={t('optional')} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" /></label>
      <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? t('saving') : t(meta.action)}</button>{message && <p className="text-sm text-gray-600">{message}</p>}
    </form>}
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden"><div className="border-b border-gray-100 px-4 py-3 font-medium">{t('history')}</div>{movements.length === 0 ? <p className="p-6 text-sm text-gray-400">{t('noOperations')}</p> : <div className="divide-y divide-gray-100">{movements.map(m => <div key={m.id} className="flex justify-between gap-4 px-4 py-3 text-sm"><div><div className="font-medium">{m.inventory_items?.name ?? t('item')}</div><div className="text-xs text-gray-500">{m.note ?? t('history')} · {new Date(m.created_at).toLocaleString()}</div></div><span className="font-medium">{m.type === 'out' ? '-' : ''}{m.quantity} {m.inventory_items?.unit ?? ''}</span></div>)}</div>}</section>
  </div>
}
