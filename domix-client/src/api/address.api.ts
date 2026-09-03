import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'

/** .NET AddressController — Israeli city/street autocomplete backed by data.gov.il. */

export async function searchCities(query: string, signal?: AbortSignal): Promise<string[]> {
  if (query.trim().length < 2) return []
  const { data } = await dataClient.get<string[]>(apiEndpoints.address.cities(), {
    params: { query: query.trim() },
    signal,
  })
  return data
}

export async function searchStreets(city: string, query: string, signal?: AbortSignal): Promise<string[]> {
  if (!city.trim() || query.trim().length < 2) return []
  const { data } = await dataClient.get<string[]>(apiEndpoints.address.streets(), {
    params: { city: city.trim(), query: query.trim() },
    signal,
  })
  return data
}
