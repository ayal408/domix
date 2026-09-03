import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as notificationsApi from '@/api/notifications.api'
import { queryKeys } from '@/api/queryKeys'
import type { CreateNotificationRequest } from '@/types/api'

export function useNotificationFeed() {
  return useQuery({
    queryKey: queryKeys.notifications.feed(),
    queryFn: ({ signal }) => notificationsApi.getNotificationFeed(signal),
  })
}

export function useMarkNotificationsSeen() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markNotificationsSeen(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}

/** Manager/Admin only. */
export function useCreateNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateNotificationRequest) => notificationsApi.createNotification(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}
