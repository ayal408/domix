import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { usePresenceStore } from '@/stores/presence.store'

/** Renders nothing — just keeps a PresenceHub connection open for as long as the user is signed in. */
export function PresenceConnector() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated')
  const connect = usePresenceStore((state) => state.connect)
  const disconnect = usePresenceStore((state) => state.disconnect)

  useEffect(() => {
    if (isAuthenticated) {
      connect()
      return disconnect
    }
  }, [isAuthenticated, connect, disconnect])

  return null
}
