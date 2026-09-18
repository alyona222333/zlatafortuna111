'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Expense {
  id: string
  category: string
  description: string | null
  amount: number
  currency: string
  spent_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Оренда', salary: 'Зарплата', delivery: 'Доставка',
  ads: 'Реклама', supplies: 'Закупівля товару', other: 'Інше',
}

export function FinanceView({
  businessId, currency, revenue30d, expenses30d, initialExpenses,
}: {
  businessId: string
  currency: string
  revenue30d: number
  expenses30d: number
  initialExpenses: Expense[]
}) {
  const t = useTranslations('newModules'); const [expenses, setExpenses] = useState(initialExpenses)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: 'other', description: '', amount: '', spent_at: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)

  const profit30d = revenue30d - expenses30d

  async function addExpense() {
    if (!form.amount) return
    setSaving(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, ...form, amount: Number(form.amount) }),
    })
    setSaving(false)
    if (res.ok) {
      const created = await res.json()
      setExpenses((prev) => [created, ...prev])
      setShowForm(false)
      setForm({ category: 'other', description: '', amount: '', spent_at: new Date().toISOString().slice(0, 10) })
    }
  }

  async function deleteExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500">{t('revenue30')}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{revenue30d.toFixed(0)} {currency}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500">{t('expenses30')}</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{expenses30d.toFixed(0)} {currency}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500">{t('netProfit')}</div>
          <div className={`text-2xl font-bold mt-1 ${profit30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profit30d.toFixed(0)} {currency}</div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="font-medium text-sm text-gray-700">{t('expenses')}</p>
        <button onClick={() => setShowForm((v) => !v)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg">+ {t('addExpense')}</button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 grid sm:grid-cols-2 gap-3 text-sm">
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={form.spent_at} onChange={(e) => setForm((f) => ({ ...f, spent_at: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" />
          <input placeholder={`${t('note')} (${t('optional')})`} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" />
          <input placeholder={t('sum')} type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" />
          <div className="sm:col-span-2 flex gap-2">
            <button onClick={addExpense} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving ? t('saving') : t('save')}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg">{t('cancel')}</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase">
              <th className="text-left px-4 py-3 font-medium">{t('date')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('category')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('note')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('sum')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t('noExpenses')}</td></tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.spent_at).toLocaleDateString('uk-UA')}</td>
                <td className="px-4 py-3">{CATEGORY_LABELS[e.category] ?? e.category}</td>
                <td className="px-4 py-3 text-gray-500">{e.description ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-red-600">-{e.amount} {e.currency}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteExpense(e.id)} className="text-xs text-gray-400 hover:text-red-500">{t('delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
