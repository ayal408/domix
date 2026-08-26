import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'
import type { CreateMessageRequest, Guid, InboxQuery, Message } from '@/types/api'

/**
 * .NET MessageController.
 *
 * Ownership rules enforced server-side, mirrored by the UI:
 *  - inbox/archive reads 403 unless `{ownerId}` equals the caller's id
 *  - archive / read / delete only affect rows the caller owns
 *  - `senderId` on a send is always overwritten with the caller's claim
 */

export async function sendMessage(payload: CreateMessageRequest): Promise<Message> {
  const { data } = await dataClient.post<Message>(apiEndpoints.messages.send(), payload)
  return data
}

/** Non-archived inbox. The server clamps `pageSize` to 100 and `page` to >= 1. */
export async function getInbox(
  ownerId: Guid,
  { page, pageSize }: InboxQuery,
  signal?: AbortSignal,
): Promise<Message[]> {
  const { data } = await dataClient.get<Message[]>(apiEndpoints.messages.inbox(ownerId), {
    params: { page, pageSize },
    signal,
  })
  return data
}

export async function getArchivedMessages(
  ownerId: Guid,
  signal?: AbortSignal,
): Promise<Message[]> {
  const { data } = await dataClient.get<Message[]>(apiEndpoints.messages.archived(ownerId), {
    signal,
  })
  return data
}

export async function archiveMessage(messageId: Guid): Promise<void> {
  await dataClient.put(apiEndpoints.messages.archive(messageId))
}

export async function markMessageAsRead(messageId: Guid): Promise<void> {
  await dataClient.put(apiEndpoints.messages.markRead(messageId))
}

/** Hard delete — the row is removed, not soft-flagged. */
export async function deleteMessage(messageId: Guid): Promise<void> {
  await dataClient.delete(apiEndpoints.messages.remove(messageId))
}
