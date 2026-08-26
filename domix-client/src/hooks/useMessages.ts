import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as messagesApi from '@/api/messages.api'
import { queryKeys } from '@/api/queryKeys'
import type { CreateMessageRequest, Guid, InboxQuery } from '@/types/api'

/**
 * `ownerId` is only missing for the instant before the auth store's profile
 * resolves; every caller sits behind `ProtectedRoute`, so it is always
 * defined by the time these queries actually run (`enabled` guards the gap).
 */
export function useInbox(ownerId: Guid | undefined, query: InboxQuery) {
  return useQuery({
    queryKey: queryKeys.messages.inbox(ownerId ?? '', query),
    queryFn: ({ signal }) => messagesApi.getInbox(ownerId as Guid, query, signal),
    enabled: !!ownerId,
    placeholderData: (previous) => previous,
  })
}

export function useArchivedMessages(ownerId: Guid | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.messages.archived(ownerId ?? ''),
    queryFn: ({ signal }) => messagesApi.getArchivedMessages(ownerId as Guid, signal),
    enabled: !!ownerId && enabled,
  })
}

function invalidateMessages(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.messages.all })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateMessageRequest) => messagesApi.sendMessage(payload),
    onSuccess: () => invalidateMessages(queryClient),
  })
}

export function useArchiveMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messageId: Guid) => messagesApi.archiveMessage(messageId),
    onSuccess: () => invalidateMessages(queryClient),
  })
}

export function useMarkMessageAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messageId: Guid) => messagesApi.markMessageAsRead(messageId),
    onSuccess: () => invalidateMessages(queryClient),
  })
}

export function useDeleteMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messageId: Guid) => messagesApi.deleteMessage(messageId),
    onSuccess: () => invalidateMessages(queryClient),
  })
}
