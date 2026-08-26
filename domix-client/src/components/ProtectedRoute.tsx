import type { ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import type { PolicyName, Role } from '@/types/api'

interface Props {
  children: ReactElement
  /** Require the signed-in user's role to satisfy this policy (see `POLICY_ROLES`). */
  policy?: PolicyName
  /** Require the signed-in user's role to be one of these, as an alternative to `policy`. */
  roles?: Role[]
}

/**
 * Gates a route on session state, redirecting to `/login` (preserving the
 * attempted location) when signed out, or `/unauthorized` when signed in but
 * missing the required role. Renders nothing while the session is still
 * being restored from the refresh cookie, to avoid a login-page flash on
 * every hard reload.
 */
export default function ProtectedRoute({ children, policy, roles }: Props): ReactElement | null {
  const status = useAuthStore((state) => state.status)
  const can = useAuthStore((state) => state.can)
  const hasRole = useAuthStore((state) => state.hasRole)
  const location = useLocation()

  if (status === 'initializing') return null

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const authorized = (!policy || can(policy)) && (!roles || hasRole(...roles))
  if (!authorized) return <Navigate to="/unauthorized" replace />

  return children
}
