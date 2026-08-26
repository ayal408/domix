import { authClient, type RetryableConfig } from '@/api/http'
import { authEndpoints } from '@/api/endpoints'
import type {
  AuthSessionResponse,
  GoogleLoginRequest,
  LoginRequest,
  RegisterRequest,
} from '@/types/api'

/**
 * Express auth service (auth-server).
 *
 * Every one of these calls sets or clears the httpOnly `refreshToken` cookie,
 * which is why they run through `authClient` (withCredentials: true).
 * `_skipAuthRefresh` keeps a failed credential check from being mistaken for an
 * expired session and triggering a pointless refresh cycle.
 */

const skipRefresh: Partial<RetryableConfig> = { _skipAuthRefresh: true }

export async function login(payload: LoginRequest): Promise<AuthSessionResponse> {
  const { data } = await authClient.post<AuthSessionResponse>(
    authEndpoints.login(),
    payload,
    skipRefresh,
  )
  return data
}

/**
 * The service hashes the password with bcrypt and creates the user through the
 * data API. It rejects with `EMAIL_EXISTS` when the address is already taken.
 */
export async function register(payload: RegisterRequest): Promise<AuthSessionResponse> {
  const { data } = await authClient.post<AuthSessionResponse>(
    authEndpoints.register(),
    payload,
    skipRefresh,
  )
  return data
}

/** Exchanges a Google Identity Services ID token for a DOMIX session. */
export async function loginWithGoogle(payload: GoogleLoginRequest): Promise<AuthSessionResponse> {
  const { data } = await authClient.post<AuthSessionResponse>(
    authEndpoints.google(),
    payload,
    skipRefresh,
  )
  return data
}

/** Clears the refresh cookie server-side. Responds 204 with no body. */
export async function logout(): Promise<void> {
  await authClient.post(authEndpoints.logout(), undefined, skipRefresh)
}
