import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dataClient } from '@/api/http'
import { useAuthStore } from '@/stores/auth.store'

export interface ExchangeAgreement {
  id: string; requesterId: string; recipientId: string
  offeredApartmentId: string; requestedApartmentId: string
  offeredHome: string; requestedHome: string
  start: string; end: string; guests: number; note: string
  status: 'Pending' | 'Accepted' | 'Declined' | 'Cancelled' | 'Countered' | 'Completed'
  recipientGuests?: number | null; requesterCompletedAt?: string | null; recipientCompletedAt?: string | null; hasReviewed?: boolean
  revision: number; createdAt: string; replacesId?: string | null
}
export interface CalendarPeriod { id: string; apartmentId: string; start: string; end: string; isAvailable: boolean }
export function useExchangeRequests() {
  const userId = useAuthStore(s => s.user?.userId)
  return useQuery({ queryKey: ['exchange', 'requests', userId], enabled: !!userId,
    queryFn: async ({ signal }) => (await dataClient.get<ExchangeAgreement[]>('/exchange/requests', { signal })).data,
    refetchInterval: 30000,
  })
}
export function useExchangeCalendar(apartmentId: string) {
  const userId = useAuthStore(s => s.user?.userId)
  return useQuery({ queryKey: ['exchange', 'calendar', userId, apartmentId], enabled: !!apartmentId && !!userId,
    queryFn: async ({ signal }) => (await dataClient.get<{ periods: CalendarPeriod[]; reservations: { id: string; start: string; end: string }[] }>(`/exchange/calendar/${encodeURIComponent(apartmentId)}`, { signal })).data,
  })
}
export function useExchangeAction() {
  const client = useQueryClient()
  return useMutation({ mutationFn: async ({ url, body, method = 'POST' }: { url: string; body?: unknown; method?: 'POST' | 'DELETE' | 'PATCH' }) => {
    const result = await dataClient.request({ url, data: body, method }); return result.data
  }, onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ['exchange'] }), client.invalidateQueries({ queryKey: ['apartments'] })])
  } })
}
export function exchangeError(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: string } | string } })?.response?.data
  return typeof data === 'string' ? data : data?.message ?? fallback
}
