import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { Header } from '@/components/layout/header'
import { ChatsView } from './chats-view'

export default async function ChatsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')

  const supabase = await createClient()

  // Clients who have telegram/viber linked (so a message could actually be
  // sent) — this is the "conversation list". Ordered by whoever has the
  // most recent activity implicitly via the messages join below.
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, phone, telegram_id, viber_user_id')
    .eq('business_id', business.id)
    .or('telegram_id.not.is.null,viber_user_id.not.is.null')
    .order('name')

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: true })
    .limit(500)

  const { data: quickReplies } = await supabase
    .from('quick_replies')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at')

  return (
    <>
      <Header title="Чати" />
      <ChatsView
        businessId={business.id}
        clients={clients ?? []}
        initialMessages={messages ?? []}
        initialQuickReplies={quickReplies ?? []}
      />
    </>
  )
}
