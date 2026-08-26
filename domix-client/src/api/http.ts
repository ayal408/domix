import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import { env } from '@/config/env'
import { authEndpoints } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import {
  clearAccessToken,
  getAccessToken,
  isAccessTokenExpired,
  setAccessToken,
} from '@/api/tokenStore'
import type { RefreshResponse } from '@/types/api'

/** Per-request flags we attach internally. */
export interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
  /** Opt out of the automatic refresh-and-retry cycle (used by auth calls). */
  _skipAuthRefresh?: boolean
}

const COMMON_HEADERS = {
  Accept: 'application/json',
  /**
   * Marks every call as a same-origin XHR. Browsers forbid cross-origin code
   * from setting this header without a successful CORS preflight, so it is a
   * cheap defence-in-depth signal against form-based CSRF on the cookie-bearing
   * auth routes (which are already SameSite-protected).
   */
  'X-Requested-With': 'XMLHttpRequest',
}

/**
 * Express auth service. Uses cookies: the refresh token is issued as an
 * httpOnly cookie, so `withCredentials` is mandatory for `/refresh` and
 * `/logout` to work at all.
 */
export const authClient: AxiosInstance = axios.create({
  baseURL: env.authUrl,
  withCredentials: true,
  timeout: 20_000,
  headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
})

/**
 * .NET data API. Authenticated purely by the `Authorization: Bearer` header —
 * it never reads cookies, which makes it structurally immune to CSRF.
 */
export const dataClient: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  withCredentials: false,
  timeout: 30_000,
  headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json' },
})

/**
 * Dedicated instance for the refresh call itself. Kept free of the response
 * interceptor so a failing refresh can never trigger another refresh.
 */
const refreshClient: AxiosInstance = axios.create({
  baseURL: env.authUrl,
  withCredentials: true,
  timeout: 20_000,
  headers: COMMON_HEADERS,
})

// ---------------------------------------------------------------------------
// Session-expiry notification
// ---------------------------------------------------------------------------

type SessionExpiredHandler = () => void
let onSessionExpired: SessionExpiredHandler | null = null

/** Registered once by the auth store so it can tear down client state. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  onSessionExpired = handler
}

// ---------------------------------------------------------------------------
// Single-flight refresh
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null

/**
 * Exchange the httpOnly refresh cookie for a new access token.
 *
 * Concurrent callers share one in-flight request: with 30-second access tokens
 * a dashboard can easily fire five queries at once, and we must not send five
 * refreshes (which would also race to rotate the cookie).
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = refreshClient
    .post<RefreshResponse>(authEndpoints.refresh())
    .then((response) => {
      const token = response.data?.accessToken ?? null
      if (!token) throw new Error('Refresh response contained no access token')
      setAccessToken(token)
      return token
    })
    .catch(() => {
      clearAccessToken()
      onSessionExpired?.()
      return null
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

// ---------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------

function attachRequestInterceptor(client: AxiosInstance): void {
  client.interceptors.request.use(async (config: RetryableConfig) => {
    // Let the browser set the multipart boundary itself.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }

    if (config._skipAuthRefresh) return config

    let token = getAccessToken()

    // Proactively renew an already-expired token instead of spending a
    // round-trip on a request we know will come back 401.
    if (token && isAccessTokenExpired(token)) {
      token = await refreshAccessToken()
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  })
}

function attachResponseInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryableConfig | undefined

      const shouldAttemptRefresh =
        error.response?.status === 401 &&
        config &&
        !config._retried &&
        !config._skipAuthRefresh

      if (shouldAttemptRefresh) {
        config._retried = true
        const token = await refreshAccessToken()

        if (token) {
          config.headers.Authorization = `Bearer ${token}`
          return client.request(config)
        }
      }

      // A 401 we could not recover from means the session is genuinely gone.
      if (error.response?.status === 401 && !config?._skipAuthRefresh) {
        clearAccessToken()
        onSessionExpired?.()
      }

      return Promise.reject(toApiError(error))
    },
  )
}

for (const client of [authClient, dataClient]) {
  attachRequestInterceptor(client)
  attachResponseInterceptor(client)
}
