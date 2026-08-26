import { jwtDecode } from 'jwt-decode'
import type { AccessTokenClaims } from '@/types/api'

/**
 * In-memory access-token holder.
 *
 * The access token is deliberately NOT persisted to localStorage/sessionStorage:
 * any XSS foothold could otherwise exfiltrate a long-lived bearer credential.
 * Durability instead comes from the `refreshToken` httpOnly + SameSite cookie
 * set by the auth service, which JavaScript cannot read. On a page reload the
 * session is re-established by a single silent `POST /refresh`.
 *
 * This module is intentionally free of React and store imports so both the
 * axios interceptors and the Zustand store can depend on it without a cycle.
 */

let accessToken: string | null = null

type Listener = (token: string | null) => void
const listeners = new Set<Listener>()

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
  for (const listener of listeners) listener(token)
}

export function clearAccessToken(): void {
  setAccessToken(null)
}

/** Subscribe to token changes. Returns an unsubscribe function. */
export function onAccessTokenChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    return jwtDecode<AccessTokenClaims>(token)
  } catch {
    return null
  }
}

/**
 * True when the token is absent, unparseable, or expires within `leewaySeconds`.
 * The auth service issues 30-second access tokens by default, so a small leeway
 * keeps us from firing a request that is guaranteed to arrive expired.
 */
export function isAccessTokenExpired(token: string | null, leewaySeconds = 5): boolean {
  if (!token) return true
  const claims = decodeAccessToken(token)
  if (!claims?.exp) return true
  return claims.exp * 1000 <= Date.now() + leewaySeconds * 1000
}

export function getUserIdFromToken(token: string | null): string | null {
  if (!token) return null
  return decodeAccessToken(token)?.userId ?? null
}
