import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { SetsView } from './sets-view'
import { getTranslations } from 'next-intl/server'

export default async function ProductSetsPage() {
  const user = await getAuthUser(); if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id); if (!business) redirect('/onboarding')
  const supabase = await createClient(); const t = await getTranslations('newModules')
  const [{ data: items }, { data: sets }] = await Promise.all([
    supabase.from('inventory_items').select('id, name, sku, sell_price').eq('business_id', business.id).order('name'),
    supabase.from('product_sets').select('id, name, description, price, is_active, created_at, product_set_items(quantity, inventory_items(name))').eq('business_id', business.id).order('name'),
  ])
  return <><Header title={t('setsTitle')} /><main className="p-4 md:p-6"><SetsView items={items ?? []} initialSets={(sets ?? []) as never} /></main></>
}
