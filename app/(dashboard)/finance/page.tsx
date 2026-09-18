import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { FinanceView } from './finance-view'

export default async function FinancePage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')

  const isOwner = business.owner_id === user.id
  let isDirector = false
  if (!isOwner) {
    const supabaseCheck = await createClient()
    const { data: myEmployee } = await supabaseCheck
      .from('employees')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    isDirector = myEmployee?.role === 'director'
  }

  // Defense in depth: even though the sidebar already hides this page from
  // anyone but the owner/director, someone could still type the URL
  // directly. RLS (migration 039/040) would return empty data for them
  // anyway, but redirecting is a clearer signal than showing a blank page.
  if (!isOwner && !isDirector) redirect('/dashboard')

  const supabase = await createClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [{ data: transactions }, { data: expenses }] = await Promise.all([
    supabase.from('transactions')
      .select('amount, created_at')
      .eq('business_id', business.id)
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo),
    supabase.from('expenses')
      .select('*')
      .eq('business_id', business.id)
      .order('spent_at', { ascending: false })
      .limit(100),
  ])

  const revenue30d = (transactions ?? []).reduce((sum, tx) => sum + Number(tx.amount), 0)
  const expenses30d = (expenses ?? [])
    .filter((e) => new Date(e.spent_at) >= new Date(thirtyDaysAgo))
    .reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <>
      <Header title="Фінанси" />
      <FinanceView
        businessId={business.id}
        currency={business.currency}
        revenue30d={revenue30d}
        expenses30d={expenses30d}
        initialExpenses={expenses ?? []}
      />
    </>
  )
}
