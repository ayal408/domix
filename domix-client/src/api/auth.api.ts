import { authClient, type RetryableConfig } from '@/api/http'
import { authEndpoints } from '@/api/endpoints'
import type {
  AuthSessionResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  GoogleLoginRequest,
  LoginRequest,
  RegisterRequest,
  ResendVerificationResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
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

/**
 * Consumes the token from the emailed verification link. Public — the visitor
 * may not have a session in this browser — so this skips the auth-refresh cycle.
 * Rejects with code `INVALID_OR_EXPIRED_TOKEN` on a bad/expired token.
 */
export async function verifyEmail(payload: VerifyEmailRequest): Promise<VerifyEmailResponse> {
  const { data } = await authClient.post<VerifyEmailResponse>(
    authEndpoints.verifyEmail(),
    payload,
    skipRefresh,
  )
  return data
}

/** Re-sends the verification email to the signed-in user. Rejects with `ALREADY_VERIFIED_OR_NOT_FOUND`. */
export async function resendVerification(): Promise<ResendVerificationResponse> {
  const { data } = await authClient.post<ResendVerificationResponse>(authEndpoints.resendVerification())
  return data
}

/** Always resolves — never reveals whether the email is registered. Public, so this skips the auth-refresh cycle. */
export async function forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  const { data } = await authClient.post<ForgotPasswordResponse>(
    authEndpoints.forgotPassword(),
    payload,
    skipRefresh,
  )
  return data
}

/** Public — the visitor isn't signed in yet. Rejects with code `INVALID_OR_EXPIRED_TOKEN` on a bad/expired token. */
export async function resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const { data } = await authClient.post<ResetPasswordResponse>(
    authEndpoints.resetPassword(),
    payload,
    skipRefresh,
  )
  return data
}
