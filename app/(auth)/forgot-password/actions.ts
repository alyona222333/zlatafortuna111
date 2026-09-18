'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSiteUrl } from '@/lib/site-url'

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get('email') as string).trim()
  const supabase = await createClient()

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  })

  // Всегда показываем успех — не раскрываем, существует ли аккаунт
  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`)
}
