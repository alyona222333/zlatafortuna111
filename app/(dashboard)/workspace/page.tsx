import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner, getMyEmployeeRole } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { WorkspaceView } from './workspace-view'

export default async function WorkspacePage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')
  const currentRole = await getMyEmployeeRole(user.id)
  const isOwner = business.owner_id === user.id
  const supabase = await createClient()
  const db = supabase as any
  const { data: channels } = await db.from('internal_channels').select('id, slug, name, description').eq('business_id', business.id).order('created_at')
  const { data: messages } = await db.from('internal_messages').select('id, body, sender_id, recipient_id, channel_id, attachment_url, attachment_name, created_at').eq('business_id', business.id).order('created_at').limit(500)
  const { data: employees } = await supabase.from('employees').select('user_id, name, role, is_active').eq('business_id', business.id).eq('is_active', true).order('name')
  const roleKey = (value: string) => {
    const normalized = value.trim().toLowerCase()
    const aliases: Record<string, string> = {
      'директор': 'director', 'генеральный директор': 'director', 'генеральний директор': 'director',
      'директор відділу продажів': 'sales_director', 'директор отдела продаж': 'sales_director',
      'менеджер з продажів': 'sales_manager',
      'менеджер з продажів — інтернет-магазин': 'sales_manager_store',
      'менеджер по продажам — интернет-магазин': 'sales_manager_store',
      'менеджер з продажів — послуги': 'sales_manager_services',
      'менеджер по продажам — услуги': 'sales_manager_services',
      'маркетолог': 'marketer', 'юрист': 'legal', 'бухгалтер': 'accountant',
      'hr / кадри': 'hr', 'hr / кадры': 'hr', 'технічна підтримка': 'it', 'техническая поддержка': 'it',
    }
    return aliases[normalized] ?? normalized
  }
  const currentRoleKey = roleKey(currentRole ?? '')
  const allowedRecipients = new Set((employees ?? []).map((employee) => employee.user_id))
  const groupSlugs = new Set(['sales', 'marketing', 'technical-support', 'hr-security'])
  const visibleChannels = (channels ?? []).filter((channel: { slug: string }) => groupSlugs.has(channel.slug))
  const chatEmployees = (employees ?? [])
    .filter((employee) => Boolean(employee.user_id && employee.user_id !== user.id && allowedRecipients.has(employee.user_id)))
    .map((employee) => ({ ...employee, user_id: employee.user_id as string }))
  return <><Header title="Робочий простір" /><WorkspaceView businessId={business.id} channels={visibleChannels} initialMessages={messages ?? []} employees={chatEmployees} userId={user.id} canDelete={isOwner || currentRoleKey === 'director'} /></>
}
