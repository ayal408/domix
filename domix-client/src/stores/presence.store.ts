import { create } from 'zustand'
import { dataClient } from '@/api/http'
import { queryClient } from '@/api/queryClient'
import { queryKeys } from '@/api/queryKeys'

interface PresenceState {
  /** Recently active signed-in users; populated only for Admin/Manager accounts. */
  activeUserCount: number | null
  connect: () => void
  disconnect: () => void
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let heartbeatInFlight = false

async function heartbeat(set: (state: Partial<PresenceState>) => void) {
  if (heartbeatInFlight) return
  heartbeatInFlight = true
  try {
    const { data } = await dataClient.post<{ activeUserCount: number | null }>('/activity/heartbeat')
    if (typeof data.activeUserCount === 'number') set({ activeUserCount: data.activeUserCount })
    void queryClient.invalidateQueries({ queryKey: queryKeys.messages.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
  } catch {
    // Activity is optional; ordinary API work and authentication remain available.
  } finally {
    heartbeatInFlight = false
  }
}

/**
 * NetFree blocks WebSockets and SignalR long polling even through the unified Vercel origin.
 * A short JSON heartbeat preserves activity counts and refreshes live data using ordinary API
 * requests, without persistent connections or bearer tokens in URLs.
 */
export const usePresenceStore = create<PresenceState>((set) => ({
  activeUserCount: null,

  connect: () => {
    if (heartbeatTimer) return
    void heartbeat(set)
    heartbeatTimer = setInterval(() => void heartbeat(set), 30_000)
  },

  disconnect: () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = null
    heartbeatInFlight = false
    set({ activeUserCount: null })
  },
}))
