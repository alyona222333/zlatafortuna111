import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessForOwner } from '@/lib/business'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const business = await getBusinessForOwner(user.id)
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  if (!body.label) return NextResponse.json({ error: 'label required' }, { status: 400 })

  const key = String(body.label).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents/diacritics
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `status_${Date.now()}`

  const { data: maxRow } = await supabase
    .from('order_statuses')
    .select('sort_order')
    .eq('business_id', business.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('order_statuses')
    .insert({
      business_id: business.id,
      key,
      label: body.label,
      color: body.color || '#94a3b8',
      sort_order: (maxRow?.sort_order ?? -1) + 1,
      is_final: !!body.is_final,
    } as never)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
