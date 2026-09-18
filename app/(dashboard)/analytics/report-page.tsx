import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { getTranslations } from 'next-intl/server'

type Report = 'sales' | 'product-status' | 'upsells' | 'managers'
export async function AnalyticsReportPage({ report, title }: { report: Report; title: string }) {
  const user = await getAuthUser(); if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id); if (!business) redirect('/onboarding')
  const supabase = await createClient()
  const t = await getTranslations('analyticsNew')
  const { data: orders } = await supabase.from('orders').select('id, items, total_amount, status, assigned_to, created_at, customer_name').eq('business_id', business.id).order('created_at', { ascending: false }).limit(500)
  const inventory = null
  const rows = new Map<string, { count: number; total: number; last: string }>()
  for (const order of orders ?? []) {
    if (report === 'sales') { const key = new Date(order.created_at).toLocaleDateString('uk-UA'); const r = rows.get(key) ?? { count: 0, total: 0, last: order.created_at }; r.count++; r.total += Number(order.total_amount) || 0; rows.set(key, r) }
    if (report === 'product-status') { const status = t((order.status || 'unknown') as 'new' | 'confirmed' | 'packed' | 'shipped' | 'done' | 'cancelled' | 'unknown'); const items = Array.isArray(order.items) ? order.items as Array<{ name?: string; qty?: number; price?: number }> : []; for (const item of items) { const name = item.name || 'Без назви'; const key = `${status}|||${name}`; const r = rows.get(key) ?? { count: 0, total: 0, last: order.created_at }; r.count += Number(item.qty) || 1; r.total += (Number(item.qty) || 1) * (Number(item.price) || 0); rows.set(key, r) } }
    if (report === 'upsells') { const items = Array.isArray(order.items) ? (order.items as Array<{ name?: string; qty?: number; price?: number }>).slice(1) : []; for (const item of items) { const key = item.name || 'Без назви'; const r = rows.get(key) ?? { count: 0, total: 0, last: order.created_at }; r.count += Number(item.qty) || 1; r.total += (Number(item.qty) || 1) * (Number(item.price) || 0); rows.set(key, r) } }
    if (report === 'managers') { const key = order.assigned_to || 'Не призначено'; const r = rows.get(key) ?? { count: 0, total: 0, last: order.created_at }; r.count++; r.total += Number(order.total_amount) || 0; rows.set(key, r) }
  }
  const sorted = [...rows.entries()].sort((a, b) => b[1].total - a[1].total)
  const description = report === 'upsells' ? t('upsellsDescription') : report === 'product-status' ? t('productStatusDescription') : t('salesReport')
  return <><Header title={title} /><main className="p-4 md:p-6"><div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">{description}</div><div className="overflow-hidden rounded-xl border border-gray-200 bg-white"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr>{report === 'product-status' && <th className="px-4 py-3">{t('orderStatus')}</th>}<th className="px-4 py-3">{t('product')}</th><th className="px-4 py-3 text-right">{t('quantity')}</th><th className="px-4 py-3 text-right">{t('sum')}</th></tr></thead><tbody>{sorted.length === 0 ? <tr><td colSpan={report === 'product-status' ? 4 : 3} className="p-10 text-center text-gray-400">{t('noReportData')}</td></tr> : sorted.map(([key, value]) => { const parts = key.split('|||'); return <tr key={key} className="border-t border-gray-100">{report === 'product-status' && <td className="px-4 py-3 font-medium">{parts[0]}</td>}<td className="px-4 py-3 font-medium">{report === 'product-status' ? parts.slice(1).join('|||') : key}</td><td className="px-4 py-3 text-right">{value.count}</td><td className="px-4 py-3 text-right">{value.total.toFixed(2)} {business.currency}</td></tr> })}</tbody></table></div></main></>
}
