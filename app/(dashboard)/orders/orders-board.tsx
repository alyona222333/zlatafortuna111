'use client'

import { useState } from 'react'

export interface OrderItem { name: string; qty: number; price: number }

export interface Order {
  id: string
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  source: string
  items: OrderItem[]
  total_amount: number
  currency: string
  delivery_method: string
  delivery_city: string | null
  delivery_branch: string | null
  delivery_address: string | null
  ttn_number: string | null
  status: string
  assigned_to: string | null
  amount_visible?: boolean
  payment_status: string
  notes: string | null
  created_at: string
}

export interface OrderStatus {
  id: string
  key: string
  label: string
  color: string
  sort_order: number
  is_final: boolean
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Нове', confirmed: 'Підтверджено', packed: 'Зібрано',
  shipped: 'Відправлено', done: 'Виконано', cancelled: 'Скасовано',
}
const STATUS_ORDER = ['new', 'confirmed', 'packed', 'shipped', 'done', 'cancelled']
const SOURCE_LABELS: Record<string, string> = {
  manual: 'Вручну', website: 'Сайт', woocommerce: 'WooCommerce',
  phone: 'Телефон', instagram: 'Instagram', facebook: 'Facebook', telegram: 'Telegram',
  meta_ads: 'Meta реклама', google_ads: 'Google Ads', google_shopping: 'Google Shopping',
  olx: 'OLX', tiktok: 'TikTok', youtube: 'YouTube', marketplace: 'Маркетплейс',
}
const DELIVERY_LABELS: Record<string, string> = {
  pickup: 'Самовивіз', nova_poshta: 'Нова Пошта', ukrposhta: 'Укрпошта', courier: 'Кур\u2019єр',
}

export function OrdersBoard({
  businessId, initialOrders, webhookUrl, woocommerceSecret, novaPoshtaKey: initialNpKey, sourceBreakdown, initialStatuses, employees, isOwnerOrDirector = true,
}: {
  businessId: string
  initialOrders: Order[]
  webhookUrl: string
  woocommerceSecret: string | null
  novaPoshtaKey?: string | null
  sourceBreakdown: Record<string, { count: number; total: number }>
  initialStatuses: OrderStatus[]
  employees: { id: string; name: string; role: string }[]
  currentEmployeeId?: string | null
  isOwnerOrDirector?: boolean
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showConnect, setShowConnect] = useState(false)
  const [secret, setSecret] = useState(woocommerceSecret)
  const [savingSecret, setSavingSecret] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [npKey, setNpKey] = useState(initialNpKey ?? '')
  const [savingNp, setSavingNp] = useState(false)
  const [lpPublic, setLpPublic] = useState('')
  const [lpPrivate, setLpPrivate] = useState('')
  const [savingLp, setSavingLp] = useState(false)

  async function saveLiqPay() {
    setSavingLp(true)
    await fetch('/api/business/woocommerce-secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, liqpay_public_key: lpPublic, liqpay_private_key: lpPrivate }),
    })
    setSavingLp(false)
  }

  async function payOrder(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}/pay`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? 'Помилка')
      return
    }
    // Submit LiqPay's own required form-post to their checkout endpoint —
    // this is how their widget works, no client SDK needed.
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = json.checkoutUrl
    form.target = '_blank'
    for (const [key, value] of Object.entries({ data: json.data, signature: json.signature })) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = key
      input.value = value as string
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
    form.remove()
  }
  const [statuses, setStatuses] = useState<OrderStatus[]>(
    initialStatuses.length > 0
      ? initialStatuses
      : STATUS_ORDER.map((key, i) => ({ id: key, key, label: STATUS_LABELS[key], color: '#94a3b8', sort_order: i, is_final: key === 'done' || key === 'cancelled' }))
  )
  const [showStatusManager, setShowStatusManager] = useState(false)
  const [newStatusLabel, setNewStatusLabel] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  async function addStatus() {
    if (!newStatusLabel.trim()) return
    setSavingStatus(true)
    const res = await fetch('/api/order-statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newStatusLabel.trim() }),
    })
    setSavingStatus(false)
    if (res.ok) {
      const created = await res.json()
      setStatuses((prev) => [...prev, created])
      setNewStatusLabel('')
    }
  }

  async function renameStatus(id: string, label: string) {
    setStatuses((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)))
    await fetch(`/api/order-statuses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
  }

  async function deleteStatus(id: string) {
    setStatuses((prev) => prev.filter((s) => s.id !== id))
    await fetch(`/api/order-statuses/${id}`, { method: 'DELETE' })
  }

  async function saveNpKey() {
    setSavingNp(true)
    await fetch('/api/business/woocommerce-secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, nova_poshta_api_key: npKey }),
    })
    setSavingNp(false)
  }

  async function updateOrder(id: string, patch: Partial<Order>) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  async function assignSelected(managerId: string) {
    if (!managerId || selectedOrderIds.length === 0) return
    setAssigning(true)
    const results = await Promise.all(selectedOrderIds.map((id) => fetch(`/api/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: managerId }),
    })))
    setAssigning(false)
    if (results.every((result) => result.ok)) {
      setOrders((prev) => prev.map((order) => selectedOrderIds.includes(order.id) ? { ...order, assigned_to: managerId } : order))
      setSelectedOrderIds([])
    } else alert('Не вдалося розподілити частину замовлень')
  }

  function toggleSelected(id: string) {
    setSelectedOrderIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  }

  async function generateSecret() {
    setSavingSecret(true)
    const newSecret = crypto.randomUUID().replace(/-/g, '')
    const res = await fetch('/api/business/woocommerce-secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, secret: newSecret }),
    })
    setSavingSecret(false)
    if (res.ok) setSecret(newSecret)
  }

  const filtered = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter)

  return (
    <div className="p-4 md:p-6 space-y-4">
      {Object.keys(sourceBreakdown).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(sourceBreakdown).map(([src, stat]) => (
            <div key={src} className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm">
              <span className="font-medium text-gray-900">{SOURCE_LABELS[src] ?? src}</span>
              <span className="text-gray-400"> · {stat.count} шт</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${statusFilter === 'all' ? 'bg-gray-900 text-white' : 'border-gray-300 text-gray-600'}`}
          >
            Всі ({orders.length})
          </button>
          {statuses.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${statusFilter === s.key ? 'bg-gray-900 text-white' : 'border-gray-300 text-gray-600'}`}
            >
              {s.label} ({orders.filter((o) => o.status === s.key).length})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {isOwnerOrDirector && (
            <button onClick={() => setShowStatusManager((v) => !v)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300">
              Статуси
            </button>
          )}
          <button onClick={() => setShowNewForm(true)} className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white">
            + Нове замовлення
          </button>
          {isOwnerOrDirector && (
            <button onClick={() => setShowConnect((v) => !v)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300">
              Підключити сайт
            </button>
          )}
        </div>
      </div>

      {isOwnerOrDirector && selectedOrderIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <span className="font-medium">Вибрано: {selectedOrderIds.length}</span>
          <select defaultValue="" onChange={(e) => { void assignSelected(e.target.value); e.currentTarget.value = '' }} disabled={assigning} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm disabled:opacity-50">
            <option value="">Розподілити менеджеру…</option>
            {employees.filter((employee) => employee.role.startsWith('sales_manager') || employee.role === 'employee').map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </select>
          <button onClick={() => setSelectedOrderIds([])} className="text-blue-700 hover:underline">Скасувати вибір</button>
        </div>
      )}

      {showStatusManager && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="font-medium text-sm">Статуси замовлень</p>
          <div className="space-y-2">
            {statuses.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <input
                  defaultValue={s.label}
                  onBlur={(e) => e.target.value !== s.label && renameStatus(s.id, e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                />
                <button onClick={() => deleteStatus(s.id)} className="text-xs text-gray-400 hover:text-red-500 px-2">Видалити</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <input
              placeholder="Нова назва статусу"
              value={newStatusLabel}
              onChange={(e) => setNewStatusLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStatus()}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={addStatus} disabled={savingStatus} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
              + Додати
            </button>
          </div>
        </div>
      )}

      {showConnect && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-3">
          <p className="font-medium">Підключення WooCommerce</p>
          <p className="text-gray-600">
            У адмінці WordPress: WooCommerce → Налаштування → Додатково → Веб-хуки → Додати веб-хук.
            Тема: <b>Order created</b> (додайте другий веб-хук з темою <b>Order updated</b>).
          </p>
          <div>
            <label className="text-xs font-medium text-gray-500">URL доставки</label>
            <div className="flex gap-2 mt-1">
              <input readOnly value={webhookUrl} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white" />
              <button onClick={() => navigator.clipboard.writeText(webhookUrl)} className="px-3 py-2 text-xs border border-gray-300 rounded-lg">Копіювати</button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Секретний ключ (вставте в поле «Секрет» веб-хука)</label>
            <div className="flex gap-2 mt-1">
              <input readOnly value={secret ?? 'ще не створено'} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white font-mono" />
              <button onClick={generateSecret} disabled={savingSecret} className="px-3 py-2 text-xs border border-gray-300 rounded-lg disabled:opacity-50">
                {savingSecret ? 'Створення…' : secret ? 'Створити новий' : 'Створити'}
              </button>
              {secret && <button onClick={() => navigator.clipboard.writeText(secret)} className="px-3 py-2 text-xs border border-gray-300 rounded-lg">Копіювати</button>}
            </div>
          </div>
          <div className="pt-2 border-t border-blue-200">
            <label className="text-xs font-medium text-gray-500">API-ключ Нової Пошти (Особистий кабінет → Налаштування → API)</label>
            <div className="flex gap-2 mt-1">
              <input
                value={npKey}
                onChange={(e) => setNpKey(e.target.value)}
                placeholder="вставте ключ сюди"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white font-mono"
              />
              <button onClick={saveNpKey} disabled={savingNp} className="px-3 py-2 text-xs border border-gray-300 rounded-lg disabled:opacity-50">
                {savingNp ? 'Збереження…' : 'Зберегти'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Поки що номери ТТН вписуються вручну (див. кожне замовлення нижче) — автоматичне створення накладних додамо наступним кроком.
            </p>
          </div>
          <div className="pt-2 border-t border-blue-200">
            <label className="text-xs font-medium text-gray-500">LiqPay — Public key / Private key (Кабінет LiqPay → Мій бізнес → API)</label>
            <div className="grid sm:grid-cols-2 gap-2 mt-1">
              <input
                value={lpPublic}
                onChange={(e) => setLpPublic(e.target.value)}
                placeholder="Public key"
                className="border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white font-mono"
              />
              <input
                value={lpPrivate}
                onChange={(e) => setLpPrivate(e.target.value)}
                placeholder="Private key"
                type="password"
                className="border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white font-mono"
              />
            </div>
            <button onClick={saveLiqPay} disabled={savingLp || !lpPublic || !lpPrivate} className="mt-2 px-3 py-2 text-xs border border-gray-300 rounded-lg disabled:opacity-50">
              {savingLp ? 'Збереження…' : 'Зберегти LiqPay'}
            </button>
          </div>
        </div>
      )}

      {showNewForm && (
        <NewOrderForm
          onClose={() => setShowNewForm(false)}
          onCreated={(order) => { setOrders((prev) => [order, ...prev]); setShowNewForm(false) }} employees={employees}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase">
              {isOwnerOrDirector && <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Вибрати всі видимі замовлення" checked={filtered.length > 0 && filtered.every((order) => selectedOrderIds.includes(order.id))} onChange={(e) => setSelectedOrderIds(e.target.checked ? filtered.map((order) => order.id) : [])} /></th>}
              <th className="text-left px-4 py-3 font-medium">Клієнт</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Джерело</th>
              <th className="text-left px-4 py-3 font-medium">Сума</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Доставка</th>
              <th className="text-left px-4 py-3 font-medium">Статус</th>
              <th className="text-left px-4 py-3 font-medium">Оплата</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Дата</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={isOwnerOrDirector ? 8 : 7} className="px-4 py-8 text-center text-gray-400">Замовлень поки немає</td></tr>
            )}
            {filtered.map((o) => (
              <OrderRow key={o.id} order={o} statuses={statuses} employees={employees} selectable={isOwnerOrDirector} selected={selectedOrderIds.includes(o.id)} onSelect={() => toggleSelected(o.id)} onUpdate={(patch) => updateOrder(o.id, patch)} onPay={() => payOrder(o.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OrderRow({ order, statuses, employees, selectable, selected, onSelect, onUpdate, onPay }: { order: Order; statuses: OrderStatus[]; employees: { id: string; name: string; role: string }[]; selectable: boolean; selected: boolean; onSelect: () => void; onUpdate: (patch: Partial<Order>) => void; onPay: () => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        {selectable && <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Вибрати замовлення ${order.customer_name}`} checked={selected} onChange={onSelect} /></td>}
        <td className="px-4 py-3 font-medium text-gray-900">
          {order.customer_name}
          <div className="text-xs text-gray-400 font-normal">{order.customer_phone ?? order.customer_email ?? ''}</div>
        </td>
        <td className="px-4 py-3 text-gray-500 hidden md:table-cell"><div>{SOURCE_LABELS[order.source] ?? order.source}</div><div className="text-[11px] text-gray-400">{employees.find((e) => e.id === order.assigned_to)?.name ?? 'Не призначено'}</div></td>
        <td className="px-4 py-3 text-gray-900">{order.amount_visible === false ? '—' : `${order.total_amount} ${order.currency}`}</td>
        <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{DELIVERY_LABELS[order.delivery_method] ?? order.delivery_method}{order.delivery_city ? `, ${order.delivery_city}` : ''}</td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <select
            value={order.status}
            onChange={(e) => onUpdate({ status: e.target.value })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1"
          >
            {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {order.payment_status === 'paid' ? (
            <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">Оплачено</span>
          ) : order.payment_status === 'pending' ? (
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">Очікує</span>
          ) : order.payment_status === 'failed' ? (
            <span className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded">Не вдалось</span>
          ) : (
            <button onClick={onPay} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50">
              Виставити оплату
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell text-xs">{new Date(order.created_at).toLocaleDateString('uk-UA')}</td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={selectable ? 8 : 7} className="px-4 py-4">
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-medium text-gray-700 mb-1">Товари</p>
                <ul className="space-y-0.5 text-gray-500">
                  {(order.items ?? []).map((it, i) => (
                    <li key={i}>{it.name} × {it.qty}{order.amount_visible === false ? '' : ` — ${it.price} ${order.currency}`}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-gray-500">Відповідальний менеджер</label>
                  <select value={order.assigned_to ?? ''} onChange={(e) => onUpdate({ assigned_to: e.target.value || null })} className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5">
                    <option value="">Не призначено</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-500">Спосіб доставки</label>
                  <select
                    value={order.delivery_method}
                    onChange={(e) => onUpdate({ delivery_method: e.target.value })}
                    className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5"
                  >
                    {Object.entries(DELIVERY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {order.delivery_method === 'nova_poshta' ? (
                  <NovaPoshtaPicker
                    city={order.delivery_city}
                    branch={order.delivery_branch}
                    onChange={(city, branch) => onUpdate({ delivery_city: city, delivery_branch: branch })}
                  />
                ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-500">Місто</label>
                    <input
                      defaultValue={order.delivery_city ?? ''}
                      onBlur={(e) => onUpdate({ delivery_city: e.target.value })}
                      className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500">Відділення / адреса</label>
                    <input
                      defaultValue={order.delivery_branch ?? order.delivery_address ?? ''}
                      onBlur={(e) => onUpdate({ delivery_branch: e.target.value })}
                      className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5"
                    />
                  </div>
                </div>
                )}
                <div>
                  <label className="text-gray-500">№ ТТН (вписати після створення накладної на сайті Нової Пошти/Укрпошти)</label>
                  <input
                    defaultValue={order.ttn_number ?? ''}
                    onBlur={(e) => onUpdate({ ttn_number: e.target.value })}
                    className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5"
                  />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function NewOrderForm({ onClose, onCreated, employees }: { onClose: () => void; onCreated: (order: Order) => void; employees: { id: string; name: string; role: string }[] }) {
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', total_amount: '', source: 'manual', assigned_to: '', delivery_method: 'pickup', delivery_city: '', delivery_branch: '' })
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, total_amount: Number(form.total_amount) || 0, assigned_to: form.assigned_to || null }),
    })
    setSaving(false)
    if (res.ok) {
      const order = await res.json()
      onCreated(order)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="font-medium text-sm">Нове замовлення</p>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <input placeholder="Ім'я клієнта *" value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" />
        <input placeholder="Телефон" value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" />
        <input placeholder="Сума" type="number" value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" />
        <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2">
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2">
          <option value="">Не призначено</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={form.delivery_method} onChange={(e) => setForm((f) => ({ ...f, delivery_method: e.target.value, delivery_city: '', delivery_branch: '' }))} className="border border-gray-200 rounded-lg px-3 py-2">
          {Object.entries(DELIVERY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {form.delivery_method === 'nova_poshta' ? (
          <div className="sm:col-span-2">
            <NovaPoshtaPicker
              city={form.delivery_city}
              branch={form.delivery_branch}
              onChange={(city, branch) => setForm((f) => ({ ...f, delivery_city: city, delivery_branch: branch }))}
            />
          </div>
        ) : (
          <>
            <input placeholder="Місто" value={form.delivery_city} onChange={(e) => setForm((f) => ({ ...f, delivery_city: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" />
            <input placeholder="Відділення / адреса" value={form.delivery_branch} onChange={(e) => setForm((f) => ({ ...f, delivery_branch: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" />
          </>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || !form.customer_name} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
          {saving ? 'Збереження…' : 'Створити'}
        </button>
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">Скасувати</button>
      </div>
    </div>
  )
}

interface NPCity { ref: string; name: string; area: string }
interface NPWarehouse { ref: string; description: string; number: string }

/** Live Nova Poshta city + branch search, replacing plain text inputs for
 *  orders shipped via Nova Poshta. Falls back gracefully (still editable
 *  as text) if the business hasn't added their API key yet — the fetch
 *  just returns an error the person can ignore and type manually. */
function NovaPoshtaPicker({
  city, branch, onChange,
}: {
  city: string | null
  branch: string | null
  onChange: (city: string, branch: string) => void
}) {
  const [cityQuery, setCityQuery] = useState(city ?? '')
  const [cityRef, setCityRef] = useState<string | null>(null)
  const [cityResults, setCityResults] = useState<NPCity[]>([])
  const [showCityList, setShowCityList] = useState(false)

  const [branchQuery, setBranchQuery] = useState(branch ?? '')
  const [branchResults, setBranchResults] = useState<NPWarehouse[]>([])
  const [showBranchList, setShowBranchList] = useState(false)
  const [npError, setNpError] = useState<string | null>(null)

  async function searchCity(q: string) {
    setCityQuery(q)
    setNpError(null)
    if (q.length < 2) { setCityResults([]); return }
    const res = await fetch(`/api/nova-poshta/cities?q=${encodeURIComponent(q)}`)
    const json = await res.json()
    if (!res.ok) { setNpError(json.error ?? 'Помилка Нової Пошти'); return }
    setCityResults(json)
    setShowCityList(true)
  }

  function pickCity(c: NPCity) {
    setCityQuery(c.name)
    setCityRef(c.ref)
    setShowCityList(false)
    setBranchQuery('')
    onChange(c.name, '')
  }

  async function searchBranch(q: string) {
    setBranchQuery(q)
    if (!cityRef) return
    const res = await fetch(`/api/nova-poshta/warehouses?cityRef=${cityRef}&q=${encodeURIComponent(q)}`)
    const json = await res.json()
    if (!res.ok) { setNpError(json.error ?? 'Помилка Нової Пошти'); return }
    setBranchResults(json)
    setShowBranchList(true)
  }

  function pickBranch(w: NPWarehouse) {
    setBranchQuery(w.description)
    setShowBranchList(false)
    onChange(cityQuery, w.description)
  }

  return (
    <div className="grid grid-cols-2 gap-2 relative">
      <div className="relative">
        <label className="text-gray-500">Місто (Нова Пошта)</label>
        <input
          value={cityQuery}
          onChange={(e) => searchCity(e.target.value)}
          onFocus={() => cityResults.length > 0 && setShowCityList(true)}
          placeholder="Почніть вводити назву…"
          className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5"
        />
        {showCityList && cityResults.length > 0 && (
          <ul className="absolute z-10 bg-white border border-gray-200 rounded-lg mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
            {cityResults.map((c) => (
              <li key={c.ref} onClick={() => pickCity(c)} className="px-2 py-1.5 hover:bg-gray-50 cursor-pointer text-xs">
                {c.name} <span className="text-gray-400">({c.area})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="relative">
        <label className="text-gray-500">Відділення</label>
        <input
          value={branchQuery}
          onChange={(e) => searchBranch(e.target.value)}
          onFocus={() => branchResults.length > 0 && setShowBranchList(true)}
          disabled={!cityRef}
          placeholder={cityRef ? 'Номер або адреса…' : 'Спочатку оберіть місто'}
          className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 disabled:bg-gray-50"
        />
        {showBranchList && branchResults.length > 0 && (
          <ul className="absolute z-10 bg-white border border-gray-200 rounded-lg mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
            {branchResults.map((w) => (
              <li key={w.ref} onClick={() => pickBranch(w)} className="px-2 py-1.5 hover:bg-gray-50 cursor-pointer text-xs">
                {w.description}
              </li>
            ))}
          </ul>
        )}
      </div>
      {npError && <p className="col-span-2 text-xs text-red-500">{npError} — можна ввести вручну, натиснувши повз список.</p>}
    </div>
  )
}
