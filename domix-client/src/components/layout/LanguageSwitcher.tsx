import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { SUPPORTED_LANGUAGES } from '@/i18n'

const LABELS: Record<string, string> = { en: 'English', he: 'עברית', es: 'Español', fr: 'Français' }

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? i18n.language

  return (
    <Menu as="div" className="relative">
      <MenuButton
        className="flex h-9 items-center gap-1 rounded px-2 text-sm font-medium text-foreground hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('nav.changeLanguage')}
      >
        {LABELS[current] ?? current}
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 mt-1 w-36 rounded-lg border border-border bg-card p-1 shadow-lg focus:outline-none"
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <MenuItem key={lng}>
            {({ focus }) => (
              <button
                type="button"
                onClick={() => i18n.changeLanguage(lng)}
                className={cn(
                  'flex w-full items-center justify-between rounded px-2 py-1.5 text-start text-sm',
                  focus && 'bg-card-muted',
                  lng === current && 'font-semibold text-primary',
                )}
              >
                {LABELS[lng]}
              </button>
            )}
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  )
}
