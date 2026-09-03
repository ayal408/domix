import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'
import type { AppNotification, CreateNotificationRequest, NotificationFeed } from '@/types/api'

/** .NET NotificationController — admin broadcast announcements, delivered live over PresenceHub. */

export async function getNotificationFeed(signal?: AbortSignal): Promise<NotificationFeed> {
  const { data } = await dataClient.get<NotificationFeed>(apiEndpoints.notifications.feed(), { signal })
  return data
}

export async function markNotificationsSeen(): Promise<void> {
  await dataClient.post(apiEndpoints.notifications.markSeen())
}

/** Manager/Admin only. */
export async function createNotification(payload: CreateNotificationRequest): Promise<AppNotification> {
  const { data } = await dataClient.post<AppNotification>(apiEndpoints.notifications.create(), payload)
  return data
}
