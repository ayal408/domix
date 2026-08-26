import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'
import type { CreateSavedSearchRequest, Guid, SavedSearch } from '@/types/api'

/** .NET SavedSearchController. The whole controller is `[Authorize]`. */

export async function getSavedSearches(signal?: AbortSignal): Promise<SavedSearch[]> {
  const { data } = await dataClient.get<SavedSearch[]>(apiEndpoints.savedSearches.list(), { signal })
  return data
}

export async function createSavedSearch(payload: CreateSavedSearchRequest): Promise<SavedSearch> {
  const { data } = await dataClient.post<SavedSearch>(apiEndpoints.savedSearches.create(), payload)
  return data
}

export async function removeSavedSearch(savedSearchId: Guid): Promise<void> {
  await dataClient.delete(apiEndpoints.savedSearches.remove(savedSearchId))
}
