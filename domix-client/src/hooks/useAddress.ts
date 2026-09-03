import { useQuery } from '@tanstack/react-query'
import * as addressApi from '@/api/address.api'
import { queryKeys } from '@/api/queryKeys'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

/** City suggestions for `query` from the Israeli street registry (data.gov.il), debounced 300ms. */
export function useCitySuggestions(query: string) {
  const debounced = useDebouncedValue(query, 300)
  return useQuery({
    queryKey: queryKeys.address.cities(debounced),
    queryFn: ({ signal }) => addressApi.searchCities(debounced, signal),
    enabled: debounced.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  })
}

/** Street suggestions within `city` for `query`, debounced 300ms. Disabled until a city is chosen. */
export function useStreetSuggestions(city: string, query: string) {
  const debounced = useDebouncedValue(query, 300)
  return useQuery({
    queryKey: queryKeys.address.streets(city, debounced),
    queryFn: ({ signal }) => addressApi.searchStreets(city, debounced, signal),
    enabled: city.trim().length > 0 && debounced.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  })
}
