import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'
import type { AnalyticsSummary } from '@/types/api'

/** .NET AnalyticsController — Manager/Admin only. */
export async function getAnalyticsSummary(signal?: AbortSignal): Promise<AnalyticsSummary> {
  const { data } = await dataClient.get<AnalyticsSummary>(apiEndpoints.analytics.summary(), { signal })
  return data
}
