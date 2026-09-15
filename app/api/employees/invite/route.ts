import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// Generates a one-time invite link for an employee row so they can set
// their own password and log in with their own role. Only the business
// owner may call this (checked below via the tenant_access_employees RLS
// policy — the select would return nothing for a non-owner in most setups,
// but we double-check owner_id explicitly since this mutates auth data).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { employeeId } = await request.json().catch(() => ({}))
  if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 })

  const admin = createServiceClient()

  const { data: employee, error: empErr } = await admin
    .from('employees')
    .select('id, business_id, name, email, user_id, businesses!inner(owner_id)')
    .eq('id', employeeId)
    .single()

  if (empErr || !employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }
  const ownerRow = employee.businesses as unknown as { owner_id: string }
  if (ownerRow.owner_id !== user.id) {
    return NextResponse.json({ error: 'Only the business owner can send invites' }, { status: 403 })
  }
  if (employee.user_id) {
    return NextResponse.json({ error: 'This employee already has a login' }, { status: 400 })
  }
  if (!employee.email) {
    return NextResponse.json({ error: 'Add an email address for this employee first' }, { status: 400 })
  }

  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const { error: updateErr } = await admin
    .from('employees')
    .update({ invite_token: token, invite_expires_at: expiresAt, invite_sent_at: new Date().toISOString() })
    .eq('id', employeeId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const inviteUrl = `${baseUrl}/invite/${token}`

  return NextResponse.json({ ok: true, inviteUrl })
}
