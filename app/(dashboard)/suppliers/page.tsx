/**
 * «Постачальники» — окремий розділ рівня керівника.
 *
 * Свідомо винесено зі «Складу»: у складі менеджер дивиться наявність і
 * працює з замовленнями, а тут — закупівельні ціни, умови і самі джерела
 * даних. Підміна прайсу переписує залишки й собівартість усього каталогу,
 * тож доступ вужчий, ніж до складу.
 */

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/header'
import { getWarehouseAccess } from '@/lib/warehouse-access'
import { SuppliersView } from './suppliers-view'

export default async function SuppliersPage() {
  const t = await getTranslations('warehouse')
  const access = await getWarehouseAccess()

  if (!access) redirect('/login')
  // Менеджера, який випадково відкрив посилання, повертаємо на склад —
  // саме там його робота. API перевіряє те саме окремо, це не єдиний замок.
  if (!access.canManageFeeds) redirect('/inventory')

  return (
    <>
      <Header title={t('suppliersTitle')} />
      <main className="p-6">
        <SuppliersView />
      </main>
    </>
  )
}
