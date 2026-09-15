import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getBusiness(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('businesses').select('id').eq('owner_id', userId).order('created_at', { ascending: true }).limit(1).maybeSingle()
  return data
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const business = await getBusiness(supabase, user.id)
  if (!business) return NextResponse.json({ error: 'business_not_found' }, { status: 404 })
  const url = new URL(request.url)
  let query = supabase.from('inventory_movements')
    .select('id, item_id, type, quantity, note, created_at, inventory_items(name, sku, unit)')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false }).limit(200)
  const kind = url.searchParams.get('kind')
  if (kind === 'return') query = query.ilike('note', 'Повернення:%')
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const business = await getBusiness(supabase, user.id)
  if (!business) return NextResponse.json({ error: 'business_not_found' }, { status: 404 })
  const body = await request.json().catch(() => ({})) as { item_id?: string; operation?: string; quantity?: number; note?: string; actual_quantity?: number; from_location?: string; to_location?: string }
  if (!body.item_id) return NextResponse.json({ error: 'item_id_required' }, { status: 400 })
  const { data: item, error: itemError } = await supabase.from('inventory_items').select('id, quantity, unit, name').eq('id', body.item_id).eq('business_id', business.id).single()
  if (itemError || !item) return NextResponse.json({ error: 'item_not_found' }, { status: 404 })

  const operation = body.operation
  let type: 'in' | 'out' | 'adjustment'
  let quantity: number
  let newQuantity: number
  let prefix: string
  if (operation === 'purchase') {
    quantity = Number(body.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) return NextResponse.json({ error: 'positive_quantity_required' }, { status: 400 })
    type = 'in'; newQuantity = Number(item.quantity) + quantity; prefix = 'Закупівля'
  } else if (operation === 'return') {
    quantity = Number(body.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) return NextResponse.json({ error: 'positive_quantity_required' }, { status: 400 })
    type = 'out'; newQuantity = Number(item.quantity) - quantity; prefix = 'Повернення'
    if (newQuantity < 0) return NextResponse.json({ error: 'quantity_exceeds_stock' }, { status: 400 })
  } else if (operation === 'stocktaking') {
    newQuantity = Number(body.actual_quantity)
    if (!Number.isFinite(newQuantity) || newQuantity < 0) return NextResponse.json({ error: 'valid_actual_quantity_required' }, { status: 400 })
    quantity = newQuantity - Number(item.quantity); type = 'adjustment'; prefix = 'Інвентаризація'
  } else if (operation === 'transfer') {
    quantity = Number(body.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) return NextResponse.json({ error: 'positive_quantity_required' }, { status: 400 })
    if (!body.from_location || !body.to_location || body.from_location === body.to_location) return NextResponse.json({ error: 'locations_required' }, { status: 400 })
    type = 'adjustment'; newQuantity = Number(item.quantity); prefix = 'Переміщення'
  } else return NextResponse.json({ error: 'unknown_operation' }, { status: 400 })

  const detail = operation === 'transfer' ? `${prefix}: ${body.from_location} → ${body.to_location}` : `${prefix}: ${body.note?.trim() || 'без примітки'}`
  const { error: updateError } = await supabase.from('inventory_items').update({ quantity: newQuantity, updated_at: new Date().toISOString() }).eq('id', item.id).eq('business_id', business.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  const { data: movement, error: movementError } = await supabase.from('inventory_movements').insert({ business_id: business.id, item_id: item.id, type, quantity: Math.abs(quantity), note: detail, created_by: user.id }).select('id').single()
  if (movementError) return NextResponse.json({ error: movementError.message }, { status: 500 })
  return NextResponse.json({ ok: true, movement_id: movement.id, quantity: newQuantity })
}
