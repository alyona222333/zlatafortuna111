'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Settings2 } from 'lucide-react'

const COLUMNS = [
  ['sku', 'SKU'], ['barcode', 'Штрихкод'], ['name', 'Назва'],
  ['short_description', 'Короткий опис'], ['description', 'Довгий опис'],
  ['stock', 'Залишок'], ['sale_price', 'Акційна ціна'], ['regular_price', 'Ціна сайту'],
  ['category', 'Категорія'], ['images', 'Фото'], ['url', 'Посилання'], ['attributes', 'Параметри'],
] as const

export function InventoryExportButton() {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(COLUMNS.map(([key]) => key))

  async function handleExport(format: 'csv' | 'xml') {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/export?format=${format}&columns=${encodeURIComponent(selected.join(','))}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      const match = (res.headers.get('Content-Disposition') ?? '').match(/filename="([^"]+)"/)
      a.download = match ? match[1] : `pronto-woocommerce.${format}`; a.click(); URL.revokeObjectURL(url)
    } finally { setLoading(false) }
  }

  function toggle(key: string) {
    setSelected((current) => current.includes(key) ? current.filter((x) => x !== key) : [...current, key])
  }

  return <div className="relative">
    <div className="flex gap-1">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}><Settings2 className="w-4 h-4 mr-1" />Колонки</Button>
      <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={loading || !selected.length}><Download className="w-4 h-4 mr-1" />{loading ? '…' : 'CSV'}</Button>
      <Button variant="outline" size="sm" onClick={() => handleExport('xml')} disabled={loading || !selected.length}><Download className="w-4 h-4 mr-1" />XML</Button>
    </div>
    {open && <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border bg-white p-3 shadow-lg">
      <div className="mb-2 text-xs text-gray-500">У CSV потраплять тільки вибрані поля. Ціни постачальників сюди не додаються.</div>
      {COLUMNS.map(([key, label]) => <label key={key} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} />{label}</label>)}
      <button className="mt-2 text-xs text-green-700" onClick={() => setSelected(COLUMNS.map(([key]) => key))}>Вибрати всі</button>
    </div>}
  </div>
}
