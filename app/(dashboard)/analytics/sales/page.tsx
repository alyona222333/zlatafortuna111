import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { AnalyticsDashboard } from '../analytics-dashboard'
import { getTranslations } from 'next-intl/server'

type Point = { label: string; count: number; total: number }
const statusLabels: Record<string, string> = { new: 'Нове', confirmed: 'Підтверджено', packed: 'Зібрано', shipped: 'Відправлено', done: 'Виконано', cancelled: 'Скасовано' }
const sourceLabels: Record<string, string> = { manual: 'Вручну', website: 'Сайт', woocommerce: 'WooCommerce', phone: 'Телефон', instagram: 'Instagram', facebook: 'Facebook', telegram: 'Telegram' }

export default async function SalesAnalyticsPage() {
  const user = await getAuthUser(); if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id); if (!business) redirect('/onboarding')
  const supabase = await createClient(); const t = await getTranslations('analyticsNew')
  const { data: orders } = await supabase.from('orders').select('items, total_amount, status, source, created_at').eq('business_id', business.id).order('created_at', { ascending: true }).limit(1000)
  const daily = new Map<string, Point>(); const statuses = new Map<string, Point>(); const sources = new Map<string, Point>(); const products = new Map<string, Point>()
  for (const order of orders ?? []) {
    const total = Number(order.total_amount) || 0
    const date = new Date(order.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
    const d = daily.get(date) ?? { label: date, count: 0, total: 0 }; d.count++; d.total += total; daily.set(date, d)
    const statusKey = statusLabels[order.status] ? order.status : order.status || 'unknown'; const s = statuses.get(statusKey) ?? { label: t(statusKey as 'new' | 'confirmed' | 'packed' | 'shipped' | 'done' | 'cancelled' | 'unknown'), count: 0, total: 0 }; s.count++; s.total += total; statuses.set(statusKey, s)
    const sourceKey = order.source || 'manual'; const source = sources.get(sourceKey) ?? { label: sourceLabels[sourceKey] ?? sourceKey, count: 0, total: 0 }; source.count++; source.total += total; sources.set(sourceKey, source)
    const items = Array.isArray(order.items) ? order.items as Array<{ name?: string; qty?: number; price?: number }> : []
    for (const item of items) { const name = item.name || 'Без назви'; const p = products.get(name) ?? { label: name, count: 0, total: 0 }; const qty = Number(item.qty) || 1; p.count += qty; p.total += qty * (Number(item.price) || 0); products.set(name, p) }
  }
  const totalOrders = orders?.length ?? 0; const totalRevenue = (orders ?? []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
  const data = { totalOrders, totalRevenue, averageOrder: totalOrders ? totalRevenue / totalOrders : 0, completedOrders: (orders ?? []).filter(o => o.status === 'done').length, daily: [...daily.values()], statuses: [...statuses.values()].sort((a, b) => b.total - a.total), sources: [...sources.values()].sort((a, b) => b.total - a.total), products: [...products.values()].sort((a, b) => b.total - a.total).slice(0, 8), currency: business.currency }
  return <><Header title={t('salesTitle')} /><AnalyticsDashboard data={data} /></>
}
