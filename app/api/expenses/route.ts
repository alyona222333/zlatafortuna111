import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (!body.businessId || !body.amount) {
    return NextResponse.json({ error: 'businessId and amount required' }, { status: 400 })
  }

  // RLS (owner_director_expenses) rejects this insert for anyone who isn't
  // the owner or a 'director' employee — the same rule that hides revenue.
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      business_id: body.businessId,
      category: body.category || 'other',
      description: body.description || null,
      amount: body.amount,
      spent_at: body.spent_at || new Date().toISOString().slice(0, 10),
    } as never)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
