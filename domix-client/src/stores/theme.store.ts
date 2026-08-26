import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Theme state: a colour palette plus a light/dark/system mode.
 *
 * Only two attributes ever land on <html> — `data-theme` (resolved to a
 * concrete light|dark) and `data-palette`. All actual colour values live in CSS
 * custom properties in index.css, so switching either one is a single attribute
 * write with no re-render of the tree and no flash.
 */

export const PALETTES = ['violet', 'ocean', 'emerald', 'sunset', 'rose'] as const
export type Palette = (typeof PALETTES)[number]

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  palette: Palette
  /** The concrete theme in effect once `system` has been resolved. */
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  setPalette: (palette: Palette) => void
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
export function applyTheme(resolved: ResolvedTheme, palette: Palette): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = resolved
  root.dataset.palette = palette
  root.style.colorScheme = resolved
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      palette: 'violet',
      resolved: resolveMode('system'),

      setMode: (mode) => {
        const resolved = resolveMode(mode)
        applyTheme(resolved, get().palette)
        set({ mode, resolved })
      },

      setPalette: (palette) => {
        applyTheme(get().resolved, palette)
        set({ palette })
      },

      toggleMode: () => {
        const next: ThemeMode = get().resolved === 'dark' ? 'light' : 'dark'
        get().setMode(next)
      },

      syncSystemPreference: () => {
        const { mode, palette } = get()
        if (mode !== 'system') return
        const resolved = resolveMode('system')
        applyTheme(resolved, palette)
        set({ resolved })
      },
    }),
    {
      name: STORAGE_KEY,
      // `resolved` is derived, so it is recomputed on rehydration rather than
      // trusted from a snapshot that may predate an OS preference change.
      partialize: (state) => ({ mode: state.mode, palette: state.palette }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const resolved = resolveMode(state.mode)
        state.resolved = resolved
        applyTheme(resolved, state.palette)
      },
    },
  ),
)

/**
 * Applies the persisted theme before React mounts, avoiding a light-mode flash
 * on a dark-mode reload, and keeps `system` mode following the OS afterwards.
 */
export function initTheme(): () => void {
  const { mode, palette } = useThemeStore.getState()
  const resolved = resolveMode(mode)
  applyTheme(resolved, palette)
  useThemeStore.setState({ resolved })

  if (typeof window === 'undefined' || !window.matchMedia) return () => {}

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => useThemeStore.getState().syncSystemPreference()
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
