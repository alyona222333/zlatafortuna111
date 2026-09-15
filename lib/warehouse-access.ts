/**
 * Хто саме звертається до «Складу».
 *
 * Розділ бачать власник, директор і менеджери з продажів (див. ROLE_SECTIONS),
 * але прав у них різна глибина:
 *
 *   читати наявність            — усі перелічені;
 *   додавати/прибирати товари   — усі перелічені (це щоденна робота менеджера);
 *   правити самі посилання на
 *   прайси та налаштування      — тільки owner/director.
 *
 * Останнє свідомо вужче: підміна URL прайсу переписує залишки і ціни всього
 * складу одним запитом, тож це рівень керівника, а не менеджера.
 */

import { createClient } from '@/lib/supabase/server'

const WAREHOUSE_ROLES = new Set([
  'director',
  'sales_manager',
  'sales_manager_store',
])

export interface WarehouseAccess {
  userId: string
  businessId: string
  isOwner: boolean
  role: string | null
  canRead: boolean
  canEditItems: boolean
  canManageFeeds: boolean
}

export async function getWarehouseAccess(): Promise<WarehouseAccess | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: owned } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (owned) {
    return {
      userId: user.id,
      businessId: owned.id,
      isOwner: true,
      role: null,
      canRead: true,
      canEditItems: true,
      canManageFeeds: true,
    }
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('business_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!employee) return null

  const role = (employee.role as string | null) ?? null
  // Вільний текст у `role` (спадок з ранніх версій) не має нікого замикати —
  // невідома роль отримує рівно права менеджера, не більше.
  const known = role ? WAREHOUSE_ROLES.has(role) : false
  const isDirector = role === 'director'

  return {
    userId: user.id,
    businessId: employee.business_id,
    isOwner: false,
    role,
    canRead: known || !role,
    canEditItems: known || !role,
    canManageFeeds: isDirector,
  }
}
