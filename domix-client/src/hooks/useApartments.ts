import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as apartmentsApi from '@/api/apartments.api'
import { queryKeys } from '@/api/queryKeys'
import type {
  Apartment,
  ApartmentSearchQuery,
  CreateApartmentRequest,
  Guid,
  RateApartmentRequest,
  UpdateApartmentRequest,
} from '@/types/api'

/** Full, unfiltered catalog. The backend has no pagination, so this is the base dataset for both the public list and the admin table. */
export function useApartments() {
  return useQuery({
    queryKey: queryKeys.apartments.list(),
    queryFn: ({ signal }) => apartmentsApi.getAllApartments(signal),
  })
}

/** Server-side filtered search — only enabled once at least one filter is set (see `hasQuery`). */
export function useApartmentSearch(query: ApartmentSearchQuery, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.apartments.search(query),
    queryFn: ({ signal }) => apartmentsApi.searchApartments(query, signal),
    enabled,
  })
}

export function useCities() {
  return useQuery({
    queryKey: queryKeys.apartments.cities(),
    queryFn: ({ signal }) => apartmentsApi.getCities(signal),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * There is no `GET /Apartment/{id}` on the backend, so a single listing is
 * selected out of the already-cached full list instead of a dedicated
 * network call. `useApartments` is the source of truth here — if the list
 * hasn't been fetched yet this triggers that same query.
 */
export function useApartmentDetail(apartmentId: Guid | undefined) {
  const list = useApartments()
  const apartment = useMemo(
    () => list.data?.find((item) => item.apartmentId === apartmentId),
    [list.data, apartmentId],
  )
  return { ...list, data: apartment }
}

function invalidateApartments(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.apartments.all })
}

export function useCreateApartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateApartmentRequest) => apartmentsApi.createApartment(payload),
    onSuccess: () => invalidateApartments(queryClient),
  })
}

export function useUpdateApartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ apartmentId, payload }: { apartmentId: Guid; payload: UpdateApartmentRequest }) =>
      apartmentsApi.updateApartment(apartmentId, payload),
    onSuccess: () => invalidateApartments(queryClient),
  })
}

export function useDeleteApartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (apartmentId: Guid) => apartmentsApi.deleteApartment(apartmentId),
    onSuccess: () => invalidateApartments(queryClient),
  })
}

export function useRateApartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ apartmentId, payload }: { apartmentId: Guid; payload: RateApartmentRequest }) =>
      apartmentsApi.rateApartment(apartmentId, payload),
    onSuccess: () => invalidateApartments(queryClient),
  })
}

export type { Apartment }
