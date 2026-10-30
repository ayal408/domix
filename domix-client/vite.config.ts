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
      rolldownOptions: {
        output: {
          // Each group also captures its modules' dependencies, so React must win on priority —
          // otherwise it is pulled into whichever group first reaches it (e.g. `forms` via
          // react-hook-form), and that chunk then loads on every page.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 40 },
              { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/, priority: 30 },
              { name: 'i18n', test: /node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/, priority: 20 },
              { name: 'forms', test: /node_modules[\\/](react-hook-form|zod|@hookform)[\\/]/, priority: 10 },
            ],
          },
        },
      },
    },
  }
})
