'use server'

import { createServiceClient } from '@/lib/supabase/service'

export async function getInvite(token: string) {
  const admin = createServiceClient()
  const { data, error } = await admin.rpc('get_employee_by_invite_token', { p_token: token })
  if (error || !data || data.length === 0) return null
  return data[0] as { id: string; business_id: string; name: string; email: string | null; role: string }
}

export async function acceptInvite(token: string, password: string) {
  if (password.length < 8) {
    return { error: 'Пароль має містити щонайменше 8 символів / Пароль должен быть не менее 8 символов' }
  }

  const admin = createServiceClient()
  const invite = await getInvite(token)
  if (!invite) {
    return { error: 'Посилання недійсне або застаріло / Ссылка недействительна или устарела' }
  }
  if (!invite.email) {
    return { error: 'У цього співробітника не вказано email / У этого сотрудника не указан email' }
  }

  // Create (or reuse, if this email already has an auth account) the login.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { name: invite.name },
  })

  let userId = created?.user?.id

  if (createErr) {
    // Most likely: an auth user with this email already exists (e.g. they
    // were invited before, or already use this email elsewhere). Look it
    // up instead of failing the whole flow.
    const { data: list } = await admin.auth.admin.listUsers()
    const existing = list?.users.find((u) => u.email?.toLowerCase() === invite.email!.toLowerCase())
    if (!existing) {
      return { error: createErr.message }
    }
    userId = existing.id
    await admin.auth.admin.updateUserById(userId, { password })
  }

  if (!userId) {
    return { error: 'Не вдалося створити обліковий запис / Не удалось создать аккаунт' }
  }

  const { error: linkErr } = await admin
    .from('employees')
    .update({
      user_id: userId,
      invite_token: null,
      invite_expires_at: null,
      invite_accepted_at: new Date().toISOString(),
      is_active: true,
    })
    .eq('id', invite.id)

  if (linkErr) {
    return { error: linkErr.message }
  }

  return { ok: true }
}
