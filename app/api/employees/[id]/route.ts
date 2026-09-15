import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createServiceClient()
  const { data: employee, error } = await admin
    .from('employees')
    .select('id, user_id, businesses!inner(owner_id)')
    .eq('id', id)
    .maybeSingle()
  if (error || !employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  const business = employee.businesses as unknown as { owner_id: string }
  if (business.owner_id !== user.id) return NextResponse.json({ error: 'Only the business owner can delete employees' }, { status: 403 })
  // New owner rows are linked to the auth user, so the owner cannot remove
  // their own employee record while other team members remain removable.
  if (employee.user_id === business.owner_id || employee.user_id === user.id) {
    return NextResponse.json({ error: 'The business owner cannot be deleted' }, { status: 400 })
  }

  const { error: deleteError } = await admin.from('employees').delete().eq('id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (employee.user_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(employee.user_id)
    if (authError) console.error('[employees/delete] auth cleanup failed:', authError.message)
  }
  return NextResponse.json({ ok: true })
}
