import { create } from 'zustand'
import * as signalR from '@microsoft/signalr'
import { env } from '@/config/env'
import { getAccessToken, isAccessTokenExpired } from '@/api/tokenStore'
import { refreshAccessToken } from '@/api/http'
import { queryClient } from '@/api/queryClient'
import { queryKeys } from '@/api/queryKeys'

interface PresenceState {
  /**
   * How many users are connected right now, across the whole site — only populated for an
   * Admin/Manager connection (PresenceHub only broadcasts to that group); stays `null` otherwise.
   */
  activeUserCount: number | null
  connect: () => void
  disconnect: () => void
}

let connection: signalR.HubConnection | null = null

async function resolveAccessToken(): Promise<string> {
  let token = getAccessToken()
  if (!token || isAccessTokenExpired(token)) {
    token = await refreshAccessToken()
  }
  return token ?? ''
}

/**
 * One WebSocket connection per browser tab, held open for as long as the user is signed in —
 * this is literally what PresenceHub counts as "active". Every signed-in user connects (see
 * `PresenceConnector` in AppShell); only an Admin/Manager connection ever receives
 * `ActiveUserCountChanged`, so `activeUserCount` is the only piece that matters to callers.
 */
export const usePresenceStore = create<PresenceState>((set) => ({
  activeUserCount: null,

  connect: () => {
    if (connection) return

    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${env.apiUrl}/hubs/presence`, { accessTokenFactory: resolveAccessToken })
      .withAutomaticReconnect()
      .build()

    connection.on('ActiveUserCountChanged', (count: number) => set({ activeUserCount: count }))
    // Every signed-in tab receives this (see NotificationHub broadcast — Clients.All), not just
    // admins, so a fresh announcement shows up live without the viewer refreshing.
    connection.on('NotificationPosted', () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    })

    connection
      .start()
      .then(() => connection?.invoke<number>('GetActiveUserCount'))
      .then((count) => {
        if (typeof count === 'number') set({ activeUserCount: count })
      })
      .catch(() => {
        // Non-admin connections reject GetActiveUserCount by design (HubException: Forbidden) —
        // activeUserCount simply stays null for them, which is the correct state.
      })
  },

  disconnect: () => {
    const current = connection
    connection = null
    set({ activeUserCount: null })
    void current?.stop()
  },
}))
