import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as savedSearchesApi from '@/api/savedSearches.api'
import { queryKeys } from '@/api/queryKeys'
import type { CreateSavedSearchRequest, Guid } from '@/types/api'

export function useSavedSearches() {
  return useQuery({
    queryKey: queryKeys.savedSearches.list(),
    queryFn: ({ signal }) => savedSearchesApi.getSavedSearches(signal),
  })
}

function invalidateSavedSearches(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches.all })
}

export function useCreateSavedSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSavedSearchRequest) => savedSearchesApi.createSavedSearch(payload),
    onSuccess: () => invalidateSavedSearches(queryClient),
  })
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (savedSearchId: Guid) => savedSearchesApi.removeSavedSearch(savedSearchId),
    onSuccess: () => invalidateSavedSearches(queryClient),
  })
}
