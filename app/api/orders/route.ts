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
  if (!body.customer_name) {
    return NextResponse.json({ error: 'customer_name required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      business_id: business.id,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone || null,
      customer_email: body.customer_email || null,
      source: body.source || 'manual',
      assigned_to: body.assigned_to || null,
      items: body.items || [],
      total_amount: body.total_amount || 0,
      delivery_method: body.delivery_method || 'pickup',
      delivery_city: body.delivery_city || null,
      delivery_branch: body.delivery_branch || null,
      delivery_address: body.delivery_address || null,
      notes: body.notes || null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
