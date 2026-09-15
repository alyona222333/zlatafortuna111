import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user.id).maybeSingle(); if (!business) return NextResponse.json({ error: 'business_not_found' }, { status: 404 })
  const { data, error } = await supabase.from('product_sets').select('id, name, description, price, is_active, created_at, product_set_items(quantity, inventory_items(id, name, sku, sell_price))').eq('business_id', business.id).order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user.id).maybeSingle(); if (!business) return NextResponse.json({ error: 'business_not_found' }, { status: 404 })
  const body = await request.json().catch(() => ({})) as { name?: string; description?: string; price?: number; items?: Array<{ item_id: string; quantity: number }> }
  if (!body.name?.trim()) return NextResponse.json({ error: 'name_required' }, { status: 400 })
  const { data: set, error } = await supabase.from('product_sets').insert({ business_id: business.id, name: body.name.trim(), description: body.description?.trim() || null, price: body.price == null ? null : Number(body.price) } as never).select('id').single()
  if (error || !set) return NextResponse.json({ error: error?.message ?? 'create_failed' }, { status: 500 })
  const setId = (set as unknown as { id: string }).id
  const items = (body.items ?? []).filter(i => i.item_id && Number(i.quantity) > 0).map(i => ({ set_id: setId, item_id: i.item_id, quantity: Number(i.quantity) }))
  if (items.length) await supabase.from('product_set_items').insert(items as never)
  return NextResponse.json({ id: setId }, { status: 201 })
}
