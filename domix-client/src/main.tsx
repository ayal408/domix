import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { initTheme } from '@/stores/theme.store'
import { toApiError } from '@/api/errors'
import { env } from '@/config/env'
import './index.css'

// Applied synchronously before the first paint so there is no light-mode flash.
initTheme()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Network failures and 5xx are worth retrying; 4xx never resolve themselves.
      retry: (failureCount, error) => toApiError(error).isRetryable && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        {env.enableDevtools && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
