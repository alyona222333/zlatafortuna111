import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { InventoryOperationView } from './inventory-operation-view'
import { getTranslations } from 'next-intl/server'

type Operation = 'purchase' | 'return' | 'transfer' | 'stocktaking'
export async function InventoryOperationPage({ operation, title, historyKind }: { operation: Operation; title: string; historyKind?: string }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')
  const supabase = await createClient(); const t = await getTranslations('newModules')
  const [{ data: items }, { data: movements }] = await Promise.all([
    supabase.from('inventory_items').select('id, name, sku, quantity, unit').eq('business_id', business.id).eq('source', 'site').eq('is_archived', false).order('name'),
    supabase.from('inventory_movements').select('id, item_id, type, quantity, note, created_at, inventory_items!inner(name, sku, unit, source, is_archived)').eq('business_id', business.id).eq('inventory_items.source', 'site').eq('inventory_items.is_archived', false).order('created_at', { ascending: false }).limit(100),
  ])
  const filtered = historyKind === 'return' ? (movements ?? []).filter(m => (m.note ?? '').startsWith('Повернення:')) : (movements ?? [])
  const translatedTitle = historyKind === 'return' && title.includes('Історія') ? t('history') : t(labelKey(operation))
  return <><Header title={translatedTitle} /><main className="p-4 md:p-6"><InventoryOperationView operation={operation} items={items ?? []} initialMovements={filtered as never} /></main></>
}

function labelKey(operation: Operation) { return operation === 'purchase' ? 'operationPurchase' : operation === 'return' ? 'operationReturn' : operation === 'transfer' ? 'operationTransfer' : 'operationStocktaking' }
