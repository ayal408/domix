/**
 * Type-safe environment configuration.
 *
 * Vite statically replaces `import.meta.env.VITE_*` at build time, so every key
 * must be referenced literally — a dynamic lookup would be inlined as
 * `undefined`. We validate once at module load and fail loudly on a bad build
 * rather than surfacing a confusing 404 at the first request.
 *
 * Deliberately dependency-free: this module is on every page's critical path,
 * and importing zod here would pull the whole forms chunk into the initial load.
 */

export interface AppEnv {
  apiUrl: string
  authUrl: string
  appName: string
  googleClientId: string | undefined
  enableDevtools: boolean
  isDev: boolean
  isProd: boolean
}

const issues: string[] = []

function booleanish(key: string, value: string): boolean {
  if (!['true', 'false', '1', '0', ''].includes(value)) issues.push(`  VITE_${key}: must be one of true, false, 1, 0`)
  return value === 'true' || value === '1'
}

/** Accepts an absolute URL or a root-relative path such as `/api`. */
function baseUrl(key: string, value: string): string {
  if (!value || !(value.startsWith('/') || /^https?:\/\//.test(value)))
    issues.push(`  VITE_${key}: must be an absolute http(s) URL or start with "/"`)
  // Normalise away a trailing slash so callers can always join with `/x`.
  return value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value
}

const appName = import.meta.env.VITE_APP_NAME ?? 'DOMIX'
if (!appName) issues.push('  VITE_appName: must not be empty')

export const env: AppEnv = {
  apiUrl: baseUrl('apiUrl', import.meta.env.VITE_API_URL ?? '/api'),
  authUrl: baseUrl('authUrl', import.meta.env.VITE_AUTH_URL ?? '/api/auth'),
  appName,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || undefined,
  enableDevtools: booleanish('enableDevtools', import.meta.env.VITE_ENABLE_DEVTOOLS ?? ''),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}

if (issues.length) throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`)

/** True when Google sign-in is fully configured and can be offered to users. */
export const isGoogleAuthEnabled = Boolean(env.googleClientId)
