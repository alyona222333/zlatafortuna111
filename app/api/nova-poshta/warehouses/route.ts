import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessForOwner } from '@/lib/business'
import { searchWarehouses } from '@/lib/novaposhta'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const business = await getBusinessForOwner(user.id)
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const npKey = (business as { nova_poshta_api_key?: string | null }).nova_poshta_api_key
  if (!npKey) return NextResponse.json({ error: 'Nova Poshta не підключено' }, { status: 400 })

  const url = new URL(request.url)
  const cityRef = url.searchParams.get('cityRef') ?? ''
  const q = url.searchParams.get('q') ?? ''
  if (!cityRef) return NextResponse.json({ error: 'cityRef required' }, { status: 400 })

  try {
    const warehouses = await searchWarehouses(npKey, cityRef, q)
    return NextResponse.json(warehouses)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Nova Poshta error' }, { status: 502 })
  }
}
