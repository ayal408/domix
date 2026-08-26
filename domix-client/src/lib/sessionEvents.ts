/**
 * Fired when an *authenticated* session is involuntarily invalidated — a 401
 * that a refresh couldn't recover from — so a component with router access
 * can redirect to `/login` exactly once.
 *
 * Kept separate from `useAuthStore`'s `status` field on purpose: a voluntary
 * `signOut()` also drives `status` to `'unauthenticated'` but must not trigger
 * this redirect (the caller already navigates itself), and the initial
 * anonymous `bootstrap()` probe drives the same transition without ever having
 * had a session to lose. Only `auth.store.ts`'s `setSessionExpiredHandler`
 * callback emits this, and only when the prior status was `'authenticated'`.
 */
type Listener = () => void
const listeners = new Set<Listener>()

export function emitSessionExpired(): void {
  for (const listener of listeners) listener()
}

/** Subscribe to session-expiry events. Returns an unsubscribe function. */
export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
