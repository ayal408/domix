import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Dev proxy notes
 * ---------------
 * In production the nginx gateway fronts both services:
 *   /api/auth/*  -> auth-server  (Express, mounts its router at `/auth`)
 *   /api/*       -> domix-server (.NET, routes are `/api/...`)
 *
 * We mirror that exact shape here so `VITE_API_URL` / `VITE_AUTH_URL` can stay
 * relative ("/api", "/api/auth") in every environment. The auth rewrite strips
 * the `/api` prefix because the Express app mounts on `/auth`, not `/api/auth`.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const authTarget = env.DEV_AUTH_TARGET || 'http://localhost:5000'
  const apiTarget = env.DEV_API_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      port: 5173,
      proxy: {
        '/api/auth': {
          target: authTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          // PresenceHub (SignalR) upgrades /api/hubs/presence to a WebSocket.
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (/[\\/](react|react-dom|react-router-dom)[\\/]/.test(id)) return 'react'
            if (id.includes('@tanstack/react-query')) return 'query'
            if (/[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/.test(id)) return 'i18n'
            if (/[\\/](react-hook-form|zod|@hookform)[\\/]/.test(id)) return 'forms'
          },
        },
      },
    },
  }
})
