import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import type { HealthStatus, SendTestEmailResponse } from '@/types/api'

/** Operational endpoints: health probe (anonymous) and the admin email test. */

/**
 * `GET /api/health/db-query`.
 * Answers 200 `{ status: "healthy" }` or 500 `{ status: "error", message }`.
 * The 500 is an expected, informative outcome here rather than a failure, so it
 * is folded into the resolved value and the panel can render it as a red state.
 */
export async function checkHealth(signal?: AbortSignal): Promise<HealthStatus> {
  try {
    const { data } = await dataClient.get<HealthStatus>(apiEndpoints.health.dbQuery(), { signal })
    return data
  } catch (error) {
    const apiError = toApiError(error)
    if (apiError.isCanceled) throw apiError
    return { status: 'error', message: apiError.message }
  }
}

/**
 * `POST /api/email/send-test` — guarded by the `AdminOnly` policy server-side.
 * The recipient is hard-coded in EmailController; the client sends no body.
 */
export async function sendTestEmail(): Promise<SendTestEmailResponse> {
  const { data } = await dataClient.post<SendTestEmailResponse>(apiEndpoints.email.sendTest())
  return data
}
