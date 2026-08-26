import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { PALETTES, useThemeStore, type ThemeMode } from '@/stores/theme.store'

const MODES: ThemeMode[] = ['light', 'dark', 'system']

const PALETTE_SWATCH: Record<(typeof PALETTES)[number], string> = {
  violet: '#7c3aed',
  ocean: '#0ea5e9',
  emerald: '#10b981',
  sunset: '#f97316',
  rose: '#e11d48',
}

export function ThemeSwitcher() {
  const { t } = useTranslation()
  const mode = useThemeStore((state) => state.mode)
  const palette = useThemeStore((state) => state.palette)
  const setMode = useThemeStore((state) => state.setMode)
  const setPalette = useThemeStore((state) => state.setPalette)

  return (
    <Menu as="div" className="relative">
      <MenuButton
        className="flex h-9 w-9 items-center justify-center rounded text-foreground hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('theme.mode')}
      >
        <span
          className="h-4 w-4 rounded-full border border-border"
          style={{ backgroundColor: PALETTE_SWATCH[palette] }}
          aria-hidden="true"
        />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 mt-1 w-56 space-y-3 rounded-lg border border-border bg-card p-3 shadow-lg focus:outline-none"
      >
        <div>
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{t('theme.mode')}</p>
          <div className="grid grid-cols-3 gap-1">
            {MODES.map((m) => (
              <MenuItem key={m}>
                <button
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded px-2 py-1.5 text-xs font-medium capitalize',
                    mode === m ? 'bg-primary text-primary-foreground' : 'bg-card-muted text-foreground hover:opacity-80',
                  )}
                >
                  {t(`theme.${m}`)}
                </button>
              </MenuItem>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{t('theme.palette')}</p>
          <div className="grid grid-cols-5 gap-1.5 px-1">
            {PALETTES.map((p) => (
              <MenuItem key={p}>
                <button
                  type="button"
                  onClick={() => setPalette(p)}
                  aria-label={t(`theme.palettes.${p}`)}
                  aria-pressed={palette === p}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform',
                    palette === p ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: PALETTE_SWATCH[p] }}
                />
              </MenuItem>
            ))}
          </div>
        </div>
      </MenuItems>
    </Menu>
  )
}
