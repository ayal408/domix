import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'
import type { CreateSupportTicketRequest, Guid, SupportTicket } from '@/types/api'

/** .NET SupportController — "Ask the team" chat escalations, and the admin support inbox. */

/** Open to anonymous visitors, same as the chat endpoint — no auth required. */
export async function createSupportTicket(payload: CreateSupportTicketRequest): Promise<SupportTicket> {
  const { data } = await dataClient.post<SupportTicket>(apiEndpoints.support.create(), payload)
  return data
}

/** Manager/Admin only. */
export async function getSupportTickets(signal?: AbortSignal): Promise<SupportTicket[]> {
  const { data } = await dataClient.get<SupportTicket[]>(apiEndpoints.support.list(), { signal })
  return data
}

/** Manager/Admin only. */
export async function resolveSupportTicket(ticketId: Guid): Promise<SupportTicket> {
  const { data } = await dataClient.patch<SupportTicket>(apiEndpoints.support.resolve(ticketId))
  return data
}
