import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as favoritesApi from '@/api/favorites.api'
import { queryKeys } from '@/api/queryKeys'
import { useAuthStore } from '@/stores/auth.store'
import type { Guid } from '@/types/api'

/** `[Authorize]`-only endpoint — disabled for anonymous visitors so cards don't fire a request that can only 401. */
export function useFavorites() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated')
  return useQuery({
    queryKey: queryKeys.favorites.list(),
    queryFn: ({ signal }) => favoritesApi.getFavorites(signal),
    enabled: isAuthenticated,
  })
}

/** Set of favorited apartment ids, for cheap membership checks in list views. */
export function useFavoriteIds() {
  const { data, ...rest } = useFavorites()
  const ids = useMemo(() => new Set((data ?? []).map((f) => f.apartmentId)), [data])
  return { ids, ...rest }
}

/** Add/remove a favorite; refetches the list once the request settles. */
export function useToggleFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ apartmentId, isFavorited }: { apartmentId: Guid; isFavorited: boolean }): Promise<void> => {
      if (isFavorited) {
        await favoritesApi.removeFavorite(apartmentId)
      } else {
        await favoritesApi.addFavorite(apartmentId)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all }),
  })
}
