import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner, getMyEmployeeRole } from '@/lib/business'
import { InventoryOperationPage } from '../inventory-operation-page'

export default async function PurchasePage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')
  const isOwner = business.owner_id === user.id
  const role = isOwner ? null : await getMyEmployeeRole(user.id)
  if (!isOwner && role !== 'director') redirect('/inventory')
  return <InventoryOperationPage operation="purchase" title="Закупка товару" />
}
