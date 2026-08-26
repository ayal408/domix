import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'
import type { Favorite, Guid } from '@/types/api'

/** .NET FavoriteController. The whole controller is `[Authorize]`. */

export async function getFavorites(signal?: AbortSignal): Promise<Favorite[]> {
  const { data } = await dataClient.get<Favorite[]>(apiEndpoints.favorites.list(), { signal })
  return data
}

export async function addFavorite(apartmentId: Guid): Promise<Favorite> {
  const { data } = await dataClient.post<Favorite>(apiEndpoints.favorites.add(apartmentId))
  return data
}

export async function removeFavorite(apartmentId: Guid): Promise<void> {
  await dataClient.delete(apiEndpoints.favorites.remove(apartmentId))
}
