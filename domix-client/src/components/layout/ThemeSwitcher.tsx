import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { useThemeStore, type ThemeMode } from '@/stores/theme.store'

const MODES: ThemeMode[] = ['light', 'dark', 'system']

function ModeIcon({ mode, className }: { mode: ThemeMode; className?: string }) {
  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

/** DOMIX ships one brand palette — this only switches light/dark/system, never colour. */
export function ThemeSwitcher() {
  const { t } = useTranslation()
  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)

  return (
    <Menu as="div" className="relative">
      <MenuButton
        className="flex h-9 w-9 items-center justify-center rounded text-foreground hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('theme.mode')}
      >
        <ModeIcon mode={mode} className="h-5 w-5" />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 mt-1 w-40 rounded-lg border border-border bg-card p-1 shadow-lg focus:outline-none"
      >
        {MODES.map((m) => (
          <MenuItem key={m}>
            <button
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm font-medium',
                mode === m ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-card-muted',
              )}
            >
              <ModeIcon mode={m} className="h-4 w-4" />
              {t(`theme.${m}`)}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  )
}
