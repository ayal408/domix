import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Theme state: light/dark/system mode only — DOMIX ships one brand palette (violet), not a
 * user-selectable accent, so there is nothing else to switch. All colour values live in CSS
 * custom properties in index.css, keyed off the single `data-theme` attribute on <html>, so
 * switching mode is one attribute write with no re-render of the tree and no flash.
 */

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  /** The concrete theme in effect once `system` has been resolved. */
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
  /** Recomputes `resolved`; called on OS preference changes. */
  syncSystemPreference: () => void
}

const STORAGE_KEY = 'domix.theme'

function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return prefersDark() ? 'dark' : 'light'
  return mode
}

/** Single place that touches the DOM, so state and document never diverge. */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolved: resolveMode('system'),

      setMode: (mode) => {
        const resolved = resolveMode(mode)
        applyTheme(resolved)
        set({ mode, resolved })
      },

      toggleMode: () => {
        const next: ThemeMode = get().resolved === 'dark' ? 'light' : 'dark'
        get().setMode(next)
      },

      syncSystemPreference: () => {
        const { mode } = get()
        if (mode !== 'system') return
        const resolved = resolveMode('system')
        applyTheme(resolved)
        set({ resolved })
      },
    }),
    {
      name: STORAGE_KEY,
      // `resolved` is derived, so it is recomputed on rehydration rather than
      // trusted from a snapshot that may predate an OS preference change.
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const resolved = resolveMode(state.mode)
        state.resolved = resolved
        applyTheme(resolved)
      },
    },
  ),
)

/**
 * Applies the persisted theme before React mounts, avoiding a light-mode flash
 * on a dark-mode reload, and keeps `system` mode following the OS afterwards.
 */
export function initTheme(): () => void {
  const { mode } = useThemeStore.getState()
  const resolved = resolveMode(mode)
  applyTheme(resolved)
  useThemeStore.setState({ resolved })

  if (typeof window === 'undefined' || !window.matchMedia) return () => {}

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => useThemeStore.getState().syncSystemPreference()
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
