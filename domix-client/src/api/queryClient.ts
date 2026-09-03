import { QueryClient } from '@tanstack/react-query'
import { toApiError } from '@/api/errors'

/**
 * Exported as a singleton (not created inline in main.tsx) so modules outside the React tree —
 * notably presence.store.ts, which invalidates the notification feed on a live socket push — can
 * reach the same cache without needing a React context.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Network failures and 5xx are worth retrying; 4xx never resolve themselves.
      retry: (failureCount, error) => toApiError(error).isRetryable && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
})
