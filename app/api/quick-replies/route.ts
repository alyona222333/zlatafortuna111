import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { businessId, title, body } = await request.json().catch(() => ({}))
  if (!businessId || !title) return NextResponse.json({ error: 'businessId and title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('quick_replies')
    .insert({ business_id: businessId, title, body: body || '' } as never)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
