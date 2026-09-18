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
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner, getMyEmployeeRole } from '@/lib/business'
import { InventoryMoreMenu } from '@/components/inventory/inventory-more-menu'
import { InventoryImportButton } from '@/components/inventory/inventory-import-button'
import { InventoryExportButton } from '@/components/inventory/inventory-export-button'
import { WarehouseTabs } from './inventory-tabs'

export default async function InventoryPage(
  props: {
    searchParams: Promise<{ filter?: string; tab?: string }>
  }
) {
  const searchParams = await props.searchParams
  const t = await getTranslations('inventory')
  const user = await getAuthUser()

  const business = await getBusinessForOwner(user!.id)
  if (!business) redirect('/onboarding')
  const isOwner = business.owner_id === user!.id
  const role = isOwner ? null : await getMyEmployeeRole(user!.id)
  const canManageSuppliers = isOwner || role === 'director'
  const isStoreManager = role === 'sales_manager_store'

  return (
    <>
      <Header
        title={t('title')}
        actions={
          <div className="flex items-center gap-2">
            {/* InventoryMoreMenu ховає ці самі кнопки в компактне меню лише
                на телефонах (sm:hidden). На десктопі, де це меню взагалі не
                рендериться, Імпорт і Експорт мають бути видні напряму —
                інакше на широкому екрані до CSV/XML просто немає доступу. */}
            <div className="hidden sm:flex items-center gap-2">
              {canManageSuppliers && <InventoryImportButton />}
              <InventoryExportButton />
            </div>
            <InventoryMoreMenu showImport={canManageSuppliers} />
            {!isStoreManager && <Link href="/inventory/new"><Button size="sm"><Plus className="w-4 h-4 mr-1" /> {t('addItem')}</Button></Link>}
          </div>
        }
      />
      {/* pb-20: на Netlify в правому нижньому куті сидить фіксований бейдж
          "Powered by Netlify", і без цього відступу він лягає точно поверх
          кнопки «наступна сторінка» в пагінації складу — клік по стрілці
          влучає в бейдж, а не в кнопку. Прибрати бейдж можна в налаштуваннях
          сайту на Netlify (Site configuration → Badges), цей відступ —
          підстраховка на випадок, якщо бейдж лишать. */}
      <main className="p-6 pb-20">
        <WarehouseTabs
          currency={business.currency}
          initialFilter={searchParams.filter}
          initialTab={searchParams.tab}
          isStoreManager={isStoreManager}
        />
      </main>
    </>
  )
}
