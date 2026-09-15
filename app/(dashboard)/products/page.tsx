import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { InventoryList } from '../inventory/inventory-list'
import { InventoryImportButton } from '@/components/inventory/inventory-import-button'
import { InventoryExportButton } from '@/components/inventory/inventory-export-button'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')
  const params = await searchParams
  const supabase = await createClient(); const t = await getTranslations('newModules')
  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, name, sku, barcode, category, unit, quantity, low_stock_threshold, cost_price, sell_price')
    .eq('business_id', business.id)
    .order('name')

  const visibleItems = params.category
    ? (items ?? []).filter((item) => (item.category ?? '') === params.category)
    : (items ?? [])

  return (
    <>
      <Header title={t('productsTitle')} actions={<div className="flex items-center gap-2"><InventoryImportButton /><InventoryExportButton /><Link href="/inventory/new"><Button size="sm"><Plus className="w-4 h-4 mr-1" /> {t('addProduct')}</Button></Link></div>} />
      <main className="p-4 md:p-6">
        <div className="mb-5 flex flex-wrap gap-2 text-sm">
          <Link href="/products" className="rounded-lg bg-blue-50 px-3 py-2 font-medium text-blue-700">{t('list')}</Link>
          <Link href="/products/categories" className="rounded-lg border border-gray-200 px-3 py-2 text-gray-600 hover:bg-gray-50">{t('categories')}</Link>
          <Link href="/products/import" className="rounded-lg border border-gray-200 px-3 py-2 text-gray-600 hover:bg-gray-50">{t('import')}</Link>
          <Link href="/products/export" className="rounded-lg border border-gray-200 px-3 py-2 text-gray-600 hover:bg-gray-50">{t('export')}</Link>
        </div>
        {params.category && <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">{t('category')}: <strong>{params.category}</strong> · <Link href="/products" className="text-blue-600 hover:underline">{t('reset')}</Link></div>}
        <InventoryList items={visibleItems} currency={business.currency} initialFilter={params.q} />
      </main>
    </>
  )
}
