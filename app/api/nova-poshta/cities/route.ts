import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBusinessForOwner } from '@/lib/business'
import { searchCities } from '@/lib/novaposhta'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const business = await getBusinessForOwner(user.id)
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const npKey = (business as { nova_poshta_api_key?: string | null }).nova_poshta_api_key
  if (!npKey) return NextResponse.json({ error: 'Nova Poshta не підключено' }, { status: 400 })

  const q = new URL(request.url).searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json([])

  try {
    const cities = await searchCities(npKey, q)
    return NextResponse.json(cities)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Nova Poshta error' }, { status: 502 })
  }
}
