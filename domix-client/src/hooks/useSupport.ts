import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as supportApi from '@/api/support.api'
import { queryKeys } from '@/api/queryKeys'
import type { CreateSupportTicketRequest, Guid } from '@/types/api'

export function useCreateSupportTicket() {
  return useMutation({
    mutationFn: (payload: CreateSupportTicketRequest) => supportApi.createSupportTicket(payload),
  })
}

/** Manager/Admin only — the admin support inbox. */
export function useSupportTickets() {
  return useQuery({
    queryKey: queryKeys.support.list(),
    queryFn: ({ signal }) => supportApi.getSupportTickets(signal),
  })
}

export function useResolveSupportTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticketId: Guid) => supportApi.resolveSupportTicket(ticketId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.support.all }),
  })
}
