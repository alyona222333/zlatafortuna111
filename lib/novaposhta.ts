/**
 * Nova Poshta JSON API — city (settlement) and warehouse (branch) search.
 * https://developers.novaposhta.ua/documentation
 *
 * Kept intentionally minimal: just the two lookups needed to fill in a
 * delivery address on an order. Full waybill (TTN) creation needs the
 * business's own sender profile (registered address, contact person) set
 * up in their Nova Poshta account first — a later step once this part is
 * confirmed working.
 */

const BASE = 'https://api.novaposhta.ua/v2.0/json/'

async function callNovaPoshta(apiKey: string, modelName: string, calledMethod: string, methodProperties: Record<string, unknown>) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.errors?.[0] || 'Nova Poshta API error')
  }
  return json.data as unknown[]
}

export interface NPCity { ref: string; name: string; area: string }
export interface NPWarehouse { ref: string; description: string; number: string }

export async function searchCities(apiKey: string, query: string): Promise<NPCity[]> {
  const data = await callNovaPoshta(apiKey, 'Address', 'searchSettlements', {
    CityName: query,
    Limit: 10,
  })
  const addresses = (data[0] as { Addresses?: unknown[] } | undefined)?.Addresses ?? []
  return (addresses as Array<Record<string, string>>).map((a) => ({
    ref: a.DeliveryCity,
    name: a.MainDescription,
    area: a.Area,
  }))
}

export async function searchWarehouses(apiKey: string, cityRef: string, query = ''): Promise<NPWarehouse[]> {
  const data = await callNovaPoshta(apiKey, 'AddressGeneral', 'getWarehouses', {
    CityRef: cityRef,
    FindByString: query || undefined,
    Limit: 20,
  })
  return (data as Array<Record<string, string>>).map((w) => ({
    ref: w.Ref,
    description: w.Description,
    number: w.Number,
  }))
}
