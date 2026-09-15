/**
 * «Склад».
 *
 * Список — це товари, вивантажені на нашому сайті (імпорт експорту сайту,
 * див. розділ «Постачальники»). Наявність у списку — з прайсів постачальників,
 * зведених по артикулу. Прайс не додає сюди нових позицій: у складі рівно
 * те, що продається в нас.
 *
 * Сама таблиця — клієнтський компонент з посторінковим завантаженням:
 * у каталозі близько десяти тисяч позицій, і рендерити їх усі в HTML
 * сторінки означало б кілька мегабайт на кожне відкриття.
 */

import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Plus, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { InventoryMoreMenu } from '@/components/inventory/inventory-more-menu'
import { WarehouseTabs } from './inventory-tabs'

export default async function InventoryPage(
  props: {
    searchParams: Promise<{ filter?: string; tab?: string }>
  }
) {
  const searchParams = await props.searchParams
  const t = await getTranslations('inventory')
  const tw = await getTranslations('warehouse')
  const user = await getAuthUser()

  const business = await getBusinessForOwner(user!.id)
  if (!business) redirect('/onboarding')

  // Зведення рахує Postgres (view warehouse_overview) — вигрібати десять
  // тисяч рядків у Node лише заради лічильника було б марно.
  const supabase = await createClient()
  const { data: overview } = await supabase
    .from('warehouse_overview')
    .select('site_items, unmatched_items, out_of_stock_items')
    .eq('business_id', business.id)
    .maybeSingle()

  const unmatched = overview?.unmatched_items ?? 0

  return (
    <>
      <Header
        title={t('title')}
        actions={
          <div className="flex items-center gap-2">
            <InventoryMoreMenu />
            <Link href="/inventory/new">
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> {t('addItem')}</Button>
            </Link>
          </div>
        }
      />
      <main className="p-6">
        {unmatched > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{tw('unmatchedBanner', { count: unmatched })}</span>
          </div>
        )}

        <WarehouseTabs
          currency={business.currency}
          initialFilter={searchParams.filter}
          initialTab={searchParams.tab}
        />
      </main>
    </>
  )
}
