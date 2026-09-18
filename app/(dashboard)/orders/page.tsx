import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { OrdersBoard } from './orders-board'

export default async function OrdersPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')

  const supabase = await createClient()
  const { data: currentEmployee } = await supabase.from('employees').select('id, role').eq('user_id', user.id).eq('business_id', business.id).eq('is_active', true).maybeSingle()
  const canViewAllAmounts = !currentEmployee || currentEmployee.role === 'director'
  const canViewAssignedAmounts = !!currentEmployee && ['sales_manager', 'sales_manager_store', 'sales_manager_services'].includes(currentEmployee.role)
  const { data: inventoryItems } = await supabase
    .from('inventory_items')
    .select('id, name, sku, quantity, sell_price, unit')
    .eq('business_id', business.id)
    .order('name')
    .limit(2000)

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: statuses } = await supabase
    .from('order_statuses')
    .select('*')
    .eq('business_id', business.id)
    .order('sort_order', { ascending: true })

  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, role')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .order('name')

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/woocommerce/${business.id}`

  // Simple "Джерела продажу" breakdown — count + total value per source,
  // computed from the same orders already loaded (no extra query needed).
  const sourceBreakdown: Record<string, { count: number; total: number }> = {}
  for (const o of orders ?? []) {
    const key = o.source || 'manual'
    if (!sourceBreakdown[key]) sourceBreakdown[key] = { count: 0, total: 0 }
    sourceBreakdown[key].count++
    sourceBreakdown[key].total += Number(o.total_amount) || 0
  }
  const visibleSourceBreakdown = canViewAllAmounts ? sourceBreakdown : Object.fromEntries(Object.entries(sourceBreakdown).map(([key, value]) => [key, { count: value.count, total: 0 }]))

  const ordersForCabinet = currentEmployee?.role === 'sales_manager_store'
    ? (orders ?? []).filter((order) => order.assigned_to === currentEmployee.id)
    : (orders ?? [])

  const visibleOrders = ordersForCabinet.map((order) => {
    const canViewAmount = canViewAllAmounts || (canViewAssignedAmounts && order.assigned_to === currentEmployee?.id)
    if (canViewAmount) return { ...order, amount_visible: true }
    return { ...order, amount_visible: false, total_amount: 0, items: Array.isArray(order.items) ? order.items.map((item: { name?: string; qty?: number }) => ({ ...item, price: 0 })) : [] }
  })

  return (
    <>
      <Header title="Замовлення" />
      <OrdersBoard
        businessId={business.id}
        initialOrders={visibleOrders as unknown as import('./orders-board').Order[]}
        webhookUrl={webhookUrl}
        woocommerceSecret={(business as { woocommerce_webhook_secret?: string | null }).woocommerce_webhook_secret ?? null}
        novaPoshtaKey={(business as { nova_poshta_api_key?: string | null }).nova_poshta_api_key ?? null}
        sourceBreakdown={visibleSourceBreakdown}
        initialStatuses={statuses ?? []}
        employees={(employees ?? []) as { id: string; name: string; role: string }[]}
        inventoryItems={(inventoryItems ?? []) as { id: string; name: string; sku: string | null; quantity: number; sell_price: number | null; unit: string }[]}
        currentEmployeeId={currentEmployee?.id ?? null}
        isOwnerOrDirector={canViewAllAmounts}
      />
    </>
  )
}
