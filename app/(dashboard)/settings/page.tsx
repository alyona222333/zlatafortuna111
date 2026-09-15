import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { getTranslations } from 'next-intl/server'
import { SettingsTabs } from './settings-tabs'
import { getAuthUser } from '@/lib/auth-user'
import { settingsTabsForRole } from '@/lib/permissions'

const BUSINESS_COLUMNS =
  'id, owner_id, name, slug, type, phone, email, address, timezone, currency, plan, plan_expires_at, telegram_bot_token, telegram_chat_id, viber_bot_token, viber_chat_id, owner_whatsapp, email_provider, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, resend_api_key, meta_whatsapp_phone_number_id, meta_whatsapp_access_token, wa_template_confirmation, wa_template_reminder, wa_template_thankyou, wa_template_reactivation, wa_template_birthday, wa_template_language, brand_color, notification_language, logo_url, enabled_modules'

export default async function SettingsPage() {
  const supabase = await createClient()
  const t = await getTranslations('settings')
  const user = await getAuthUser()
  if (!user) redirect('/login')

  // Try as the owner first...
  let { data: business } = await supabase
    .from('businesses')
    .select(BUSINESS_COLUMNS)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let myRole: string | null = null
  const isOwner = !!business

  // ...otherwise this may be a logged-in employee (director, HR, sales,
  // marketer, IT, analyst, etc.) rather than the account owner. They don't
  // own a businesses row, so the query above returns nothing — that used to
  // send every non-owner straight to /onboarding. Look them up via their
  // employee record instead; RLS (tenant_access_*) already allows this once
  // employees.user_id is linked and is_active = true.
  if (!business) {
    const { data: myEmployee } = await supabase
      .from('employees')
      .select('business_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (myEmployee) {
      myRole = myEmployee.role
      const { data: biz } = await supabase
        .from('businesses')
        .select(BUSINESS_COLUMNS)
        .eq('id', myEmployee.business_id)
        .maybeSingle()
      business = biz
    }
  }

  if (!business) redirect('/onboarding')

  const [
    { data: services },
    { data: employees },
    { data: businessHours },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, price, duration_min, category, is_active, capacity')
      .eq('business_id', business.id)
      .order('name'),
    supabase
      .from('employees')
      .select('id, name, role, email, phone, is_active, user_id, invite_sent_at, invite_accepted_at')
      .eq('business_id', business.id)
      .order('name'),
    supabase
      .from('business_hours')
      .select('day_of_week, is_open, open_time, close_time, break_start, break_end')
      .eq('business_id', business.id)
      .order('day_of_week'),
  ])

  const allowedTabs = settingsTabsForRole(myRole, isOwner)

  return (
    <>
      <Header title={t('title')} />
      <SettingsTabs
        business={business}
        services={services ?? []}
        employees={employees ?? []}
        workingHours={businessHours ?? []}
        userEmail={user.email ?? ''}
        isOwner={isOwner}
        allowedTabs={allowedTabs}
      />
    </>
  )
}
