import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'

const SOURCES: Record<string, string> = {
  manual: 'Вручну', website: 'Сайт', woocommerce: 'WooCommerce', phone: 'Телефон',
  instagram: 'Instagram', facebook: 'Facebook', telegram: 'Telegram', meta_ads: 'Meta реклама',
  google_ads: 'Google Ads', google_shopping: 'Google Shopping', olx: 'OLX', tiktok: 'TikTok',
  youtube: 'YouTube', marketplace: 'Маркетплейс',
}

export default async function SaleSourcesPage() {
  const user = await getAuthUser(); if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id); if (!business) redirect('/onboarding')
  const supabase = await createClient()
  const { data: orders } = await supabase.from('orders').select('source, total_amount').eq('business_id', business.id)
  const stats = Object.entries(SOURCES).map(([key, label]) => { const own = (orders ?? []).filter((o) => (o.source || 'manual') === key); return { key, label, count: own.length, total: own.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) } }).filter((x) => x.count > 0 || ['website','instagram','facebook','meta_ads','google_ads','google_shopping','olx'].includes(x.key))
  return <><Header title="Джерела продажу" /><main className="p-4 md:p-6"><div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">Тут видно, звідки приходять ліди та замовлення. При створенні заявки менеджер може вибрати канал, а інтеграції можуть передавати його автоматично.</div><div className="overflow-hidden rounded-xl border border-gray-200 bg-white"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Джерело</th><th className="px-4 py-3 text-right">Замовлення</th><th className="px-4 py-3 text-right">Сума</th></tr></thead><tbody>{stats.map((s) => <tr key={s.key} className="border-t border-gray-100"><td className="px-4 py-3 font-medium">{s.label}</td><td className="px-4 py-3 text-right">{s.count}</td><td className="px-4 py-3 text-right">{s.total.toFixed(2)} {business.currency}</td></tr>)}</tbody></table></div></main></>
}
