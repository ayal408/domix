import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import * as authApi from '@/api/auth.api'
import * as usersApi from '@/api/users.api'
import { refreshAccessToken, setSessionExpiredHandler } from '@/api/http'
import { clearAccessToken, getUserIdFromToken, setAccessToken } from '@/api/tokenStore'
import { onSessionExpired } from '@/lib/sessionEvents'
import type { AuthSessionResponse, AuthUser, UserResponse } from '@/types/api'

vi.mock('@/api/auth.api')
vi.mock('@/api/users.api')
vi.mock('@/api/tokenStore')
vi.mock('@/api/http')

const authUser: AuthUser = {
  userId: 'user-1',
  userName: 'jane',
  email: 'jane@example.com',
  phone: null,
  googleId: null,
  registrationMethod: 'Password',
  profileImageBase64: null,
}

const fullProfile: UserResponse = {
  userId: 'user-1',
  userName: 'jane',
  registrationMethod: 'Password',
  googleId: null,
  emailAddress: 'jane@example.com',
  phoneNumber: null,
  role: 'Manager',
  joiningDate: '2024-01-01T00:00:00Z',
  profileColor: null,
  profileImageBase64: null,
}

const session: AuthSessionResponse = { user: authUser, accessToken: 'access-token' }

// `auth.store.ts` registers this handler once, as a module-load side effect,
// before any `beforeEach` (and its `vi.clearAllMocks()`) can run — so it must
// be captured here, at collection time, not read back from the mock later.
const sessionExpiredHandler = vi.mocked(setSessionExpiredHandler).mock.calls[0]?.[0]

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ status: 'initializing', user: null })
})

describe('useAuthStore.bootstrap', () => {
  it('drops to unauthenticated when there is no refresh cookie', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue(null)

    await useAuthStore.getState().bootstrap()

    expect(useAuthStore.getState().status).toBe('unauthenticated')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('clears the token and drops out when the token has no decodable userId', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue('bad-token')
    vi.mocked(getUserIdFromToken).mockReturnValue(null)

    await useAuthStore.getState().bootstrap()

    expect(clearAccessToken).toHaveBeenCalled()
    expect(useAuthStore.getState().status).toBe('unauthenticated')
  })

  it('restores the full profile when the token and profile fetch both succeed', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue('good-token')
    vi.mocked(getUserIdFromToken).mockReturnValue('user-1')
    vi.mocked(usersApi.getUserById).mockResolvedValue(fullProfile)

    await useAuthStore.getState().bootstrap()

    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(useAuthStore.getState().user).toEqual(fullProfile)
  })

  it('treats an unreachable profile service as an unusable session rather than guessing a role', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue('good-token')
    vi.mocked(getUserIdFromToken).mockReturnValue('user-1')
    vi.mocked(usersApi.getUserById).mockRejectedValue(new Error('network down'))

    await useAuthStore.getState().bootstrap()

    expect(clearAccessToken).toHaveBeenCalled()
    expect(useAuthStore.getState().status).toBe('unauthenticated')
  })
})

describe('useAuthStore.signInWithPassword', () => {
  it('stores the access token and upgrades to the full profile on success', async () => {
    vi.mocked(authApi.login).mockResolvedValue(session)
    vi.mocked(usersApi.getUserById).mockResolvedValue(fullProfile)

    await useAuthStore.getState().signInWithPassword('jane', 'secret')

    expect(setAccessToken).toHaveBeenCalledWith('access-token')
    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(useAuthStore.getState().user).toEqual(fullProfile)
  })

  it('falls back to a "User"-role profile if the data API is unreachable right after sign-in', async () => {
    vi.mocked(authApi.login).mockResolvedValue(session)
    vi.mocked(usersApi.getUserById).mockRejectedValue(new Error('down'))

    await useAuthStore.getState().signInWithPassword('jane', 'secret')

    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(useAuthStore.getState().user?.role).toBe('User')
  })
})

describe('useAuthStore.signOut', () => {
  it('clears local session state even when the server call fails', async () => {
    useAuthStore.setState({ status: 'authenticated', user: fullProfile })
    vi.mocked(authApi.logout).mockRejectedValue(new Error('boom'))

    await useAuthStore.getState().signOut()

    expect(clearAccessToken).toHaveBeenCalled()
    expect(useAuthStore.getState().status).toBe('unauthenticated')
    expect(useAuthStore.getState().user).toBeNull()
  })
})

describe('useAuthStore.hasRole / can', () => {
  it('returns false when signed out', () => {
    expect(useAuthStore.getState().hasRole('Admin')).toBe(false)
    expect(useAuthStore.getState().can('ManagerOrAdmin')).toBe(false)
  })

  it('matches the signed-in user role against the requested roles/policy', () => {
    useAuthStore.setState({ status: 'authenticated', user: fullProfile }) // role: 'Manager'

    expect(useAuthStore.getState().hasRole('Manager', 'Admin')).toBe(true)
    expect(useAuthStore.getState().hasRole('Admin')).toBe(false)
    expect(useAuthStore.getState().can('ManagerOrAdmin')).toBe(true)
    expect(useAuthStore.getState().can('AdminOnly')).toBe(false)
  })
})

describe('session-expired wiring', () => {
  it('registers a handler that drops an authenticated session to unauthenticated and emits a redirect signal', () => {
    expect(sessionExpiredHandler).toBeDefined()

    const onExpired = vi.fn()
    const unsubscribe = onSessionExpired(onExpired)

    useAuthStore.setState({ status: 'authenticated', user: fullProfile })
    sessionExpiredHandler?.()

    expect(useAuthStore.getState().status).toBe('unauthenticated')
    expect(useAuthStore.getState().user).toBeNull()
    expect(onExpired).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  it('does nothing for the anonymous bootstrap probe (status still "initializing")', () => {
    const onExpired = vi.fn()
    const unsubscribe = onSessionExpired(onExpired)

    useAuthStore.setState({ status: 'initializing', user: null })
    sessionExpiredHandler?.()

    // No session to lose, so no forced redirect to /login for a first-time visitor.
    expect(onExpired).not.toHaveBeenCalled()

    unsubscribe()
  })

  it('is a no-op if the session was already unauthenticated', () => {
    const onExpired = vi.fn()
    const unsubscribe = onSessionExpired(onExpired)

    useAuthStore.setState({ status: 'unauthenticated', user: null })
    sessionExpiredHandler?.()

    expect(onExpired).not.toHaveBeenCalled()

    unsubscribe()
  })
})
