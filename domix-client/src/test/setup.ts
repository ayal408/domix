import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
// Use English explicitly for existing component assertions; production defaults to Hebrew.
// Initialises the real i18next instance so
// component tests can assert on rendered, translated text instead of raw keys.
import i18n from '@/i18n'
void i18n.changeLanguage('en')

// `globals: false` (see vitest.config.ts) means Testing Library's own
// auto-cleanup hook never registers, so each rendered tree would otherwise
// leak into the next test's DOM.
afterEach(() => {
  cleanup()
})
