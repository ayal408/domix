import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    // Transform the picker ESM entry; its published main points to CJS in a type:module package.
    server: { deps: { inline: ['react-hebrew-datepicker'] } },
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/i18n/**',
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
      ],
    },
  },
})
