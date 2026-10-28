import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as apartmentsApi from '@/api/apartments.api'
import { queryKeys } from '@/api/queryKeys'
import type {
  Apartment,
  ApartmentSearchQuery,
  ApartmentStatusValue,
  CreateApartmentRequest,
  Guid,
  RateApartmentRequest,
  UpdateApartmentRequest,
} from '@/types/api'

/** Complete catalog for management/map consumers, fetched in bounded pages. */
export function useApartments(enabled = true) {
  return useQuery({
    enabled,
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

/** Fetch one listing without loading the complete catalog. */
export function useApartmentDetail(apartmentId: Guid | undefined) {
  return useQuery({
    queryKey: queryKeys.apartments.detail(apartmentId ?? ''),
    queryFn: ({ signal }) => apartmentsApi.getApartment(apartmentId!, signal),
    enabled: !!apartmentId,
  })
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

export function useSetApartmentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ apartmentId, status }: { apartmentId: Guid; status: ApartmentStatusValue }) =>
      apartmentsApi.setApartmentStatus(apartmentId, { status }),
    onSuccess: () => invalidateApartments(queryClient),
  })
}

export type { Apartment }

export function useApartmentPages(query: ApartmentSearchQuery, ownerId?: string) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.apartments.search(query), 'pages', ownerId],
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) => apartmentsApi.searchApartments(query, signal, { offset: pageParam, pageSize: 24, ownerId }),
    getNextPageParam: (lastPage, pages) => lastPage.length === 24 ? pages.length * 24 : undefined,
  })
}
