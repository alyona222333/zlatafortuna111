import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export async function OrderToolsPage({ mode }: { mode: 'basket' | 'duplicate' }) {
  const user = await getAuthUser(); if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id); if (!business) redirect('/onboarding')
  const supabase = await createClient(); const t = await getTranslations('newModules')
  const { data: orders } = await supabase.from('orders').select('id, customer_name, customer_phone, total_amount, currency, status, created_at').eq('business_id', business.id).order('created_at', { ascending: false }).limit(500)
  const rows = mode === 'basket' ? (orders ?? []).filter(o => ['new', 'confirmed', 'packed'].includes(o.status)) : (() => { const seen = new Set<string>(); return (orders ?? []).filter(o => { const key = (o.customer_phone || o.customer_name).trim().toLowerCase(); if (seen.has(key)) return true; seen.add(key); return false }) })()
  const title = mode === 'basket' ? t('basketTitle') : t('duplicatesTitle'); const hint = mode === 'basket' ? t('basketHint') : t('duplicatesHint')
  return <><Header title={title} /><main className="p-4 md:p-6"><div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">{hint}</div><div className="overflow-hidden rounded-xl border border-gray-200 bg-white"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">{t('client')}</th><th className="px-4 py-3">{t('status')}</th><th className="px-4 py-3 text-right">{t('sum')}</th><th className="px-4 py-3">{t('date')}</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={4} className="p-10 text-center text-gray-400">{t('noRecords')}</td></tr> : rows.map(o => <tr key={o.id} className="border-t border-gray-100"><td className="px-4 py-3"><Link href="/orders" className="font-medium text-blue-600 hover:underline">{o.customer_name}</Link><div className="text-xs text-gray-400">{o.customer_phone || t('phoneMissing')}</div></td><td className="px-4 py-3">{o.status}</td><td className="px-4 py-3 text-right">{Number(o.total_amount).toFixed(2)} {o.currency}</td><td className="px-4 py-3 text-gray-500">{new Date(o.created_at).toLocaleString()}</td></tr>)}</tbody></table></div></main></>
}
