import { useQuery } from '@tanstack/react-query'
import * as analyticsApi from '@/api/analytics.api'
import { queryKeys } from '@/api/queryKeys'

/** Manager/Admin only — the admin analytics dashboard. */
export function useAnalyticsSummary() {
  return useQuery({
    queryKey: queryKeys.analytics.summary,
    queryFn: ({ signal }) => analyticsApi.getAnalyticsSummary(signal),
    staleTime: 60 * 1000,
  })
}
