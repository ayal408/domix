import { create } from 'zustand'
import * as authApi from '@/api/auth.api'
import * as usersApi from '@/api/users.api'
import {
  clearAccessToken,
  getAccessToken,
  getUserIdFromToken,
  setAccessToken,
} from '@/api/tokenStore'
import { refreshAccessToken, setSessionExpiredHandler } from '@/api/http'
import { emitSessionExpired } from '@/lib/sessionEvents'
import { POLICY_ROLES, type AuthSessionResponse, type PolicyName, type Role, type UserResponse } from '@/types/api'

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated'

interface AuthState {
  status: AuthStatus
  /** Full profile from the data API — the only place `role` is trustworthy. */
  user: UserResponse | null

  /** Restores a session from the httpOnly refresh cookie. Runs once at boot. */
  bootstrap: () => Promise<void>
  signInWithPassword: (userName: string, password: string) => Promise<void>
  signUp: (input: { userName: string; email: string; password: string; phone?: string }) => Promise<void>
  signInWithGoogle: (idToken: string) => Promise<void>
  signOut: () => Promise<void>
  /** Re-reads the profile, e.g. after changing the avatar. */
  refreshProfile: () => Promise<void>
  /** Replaces the cached profile without a round-trip. */
  setUser: (user: UserResponse) => void

  hasRole: (...roles: Role[]) => boolean
  can: (policy: PolicyName) => boolean
}

/**
 * Builds a usable profile when the data API cannot be reached right after
 * sign-in. `role` falls back to the server's own default for new accounts, so a
 * degraded session can never silently grant elevated access.
 */
function fallbackProfile(session: AuthSessionResponse): UserResponse {
  const { user } = session
  return {
    userId: user.userId,
    userName: user.userName,
    registrationMethod: user.registrationMethod,
    googleId: user.googleId,
    emailAddress: user.email,
    phoneNumber: user.phone,
    role: 'User',
    joiningDate: new Date().toISOString(),
    profileColor: null,
    profileImageBase64: user.profileImageBase64,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'initializing',
  user: null,

  bootstrap: async () => {
    const token = await refreshAccessToken()

    if (!token) {
      set({ status: 'unauthenticated', user: null })
      return
    }

    const userId = getUserIdFromToken(token)
    if (!userId) {
      clearAccessToken()
      set({ status: 'unauthenticated', user: null })
      return
    }

    try {
      const user = await usersApi.getUserById(userId)
      set({ status: 'authenticated', user })
    } catch {
      // The token is valid but the profile is unreachable. Treat the session as
      // unusable rather than guessing at a role.
      clearAccessToken()
      set({ status: 'unauthenticated', user: null })
    }
  },

  signInWithPassword: async (userName, password) => {
    const session = await authApi.login({ userName, password })
    await hydrateSession(session, set)
  },

  signUp: async (input) => {
    const session = await authApi.register({
      userName: input.userName,
      email: input.email,
      password: input.password,
      ...(input.phone ? { phone: input.phone } : {}),
    })
    await hydrateSession(session, set)
  },

  signInWithGoogle: async (idToken) => {
    const session = await authApi.loginWithGoogle({ idToken })
    await hydrateSession(session, set)
  },

  signOut: async () => {
    try {
      await authApi.logout()
    } catch {
      // Clearing local state matters more than the server acknowledging it.
    } finally {
      clearAccessToken()
      set({ status: 'unauthenticated', user: null })
    }
  },

  refreshProfile: async () => {
    const userId = get().user?.userId ?? getUserIdFromToken(getAccessToken())
    if (!userId) return
    const user = await usersApi.getUserById(userId)
    set({ user })
  },

  setUser: (user) => set({ user }),

  hasRole: (...roles) => {
    const role = get().user?.role
    return role ? roles.includes(role) : false
  },

  can: (policy) => {
    const role = get().user?.role
    if (!role) return false
    return (POLICY_ROLES[policy] as readonly Role[]).includes(role)
  },
}))

/**
 * Shared post-sign-in path: store the bearer token, then upgrade the auth
 * service's thin user object to the full profile so `role` is populated.
 */
async function hydrateSession(
  session: AuthSessionResponse,
  set: (partial: Partial<AuthState>) => void,
): Promise<void> {
  setAccessToken(session.accessToken)

  try {
    const user = await usersApi.getUserById(session.user.userId)
    set({ status: 'authenticated', user })
  } catch {
    set({ status: 'authenticated', user: fallbackProfile(session) })
  }
}

/**
 * Wire the transport layer's "refresh failed" signal into the store, so an
 * expired session drops the UI to the signed-out state exactly once, from
 * wherever the failing request happened to originate.
 *
 * `refreshAccessToken()` also fires this same callback during the anonymous
 * `bootstrap()` probe (there is no cookie yet, so the refresh "fails") — the
 * `status !== 'authenticated'` guard is what keeps that silent, and keeps a
 * genuine mid-session expiry (`'authenticated' -> 'unauthenticated'`) as the
 * only case that emits `emitSessionExpired()` for `App.tsx` to redirect on.
 */
setSessionExpiredHandler(() => {
  const { status } = useAuthStore.getState()
  if (status !== 'authenticated') return
  useAuthStore.setState({ status: 'unauthenticated', user: null })
  emitSessionExpired()
})
