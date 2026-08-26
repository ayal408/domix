import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
// Initialises the real i18next instance (English by default in jsdom) so
// component tests can assert on rendered, translated text instead of raw keys.
import '@/i18n'

// `globals: false` (see vitest.config.ts) means Testing Library's own
// auto-cleanup hook never registers, so each rendered tree would otherwise
// leak into the next test's DOM.
afterEach(() => {
  cleanup()
})
