import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useThemeStore, type ThemeMode } from '@/stores/theme.store'
import * as usersApi from '@/api/users.api'

const VALID_MODES: readonly string[] = ['light', 'dark', 'system']

/** Renders nothing — keeps the theme mode and the signed-in user's saved preference in sync. */
export function ThemeSync() {
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)
  const lastAppliedUserId = useRef<string | null>(null)

  // Pull: once per sign-in, apply whatever this account last saved (if anything).
  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      lastAppliedUserId.current = null
      return
    }
    if (lastAppliedUserId.current === user.userId) return
    lastAppliedUserId.current = user.userId

    const pref = user.themePreference
    if (pref && VALID_MODES.includes(pref)) {
      setMode(pref as ThemeMode)
    }
  }, [status, user, setMode])

  // Push: mirror every local change back to the account so it follows the user across devices.
  useEffect(() => {
    if (status !== 'authenticated') return
    void usersApi.updateThemePreference({ themePreference: mode }).catch(() => {
      // Best-effort — the switch already applied locally regardless of whether this saved.
    })
  }, [mode, status])

  return null
}
