import { z } from 'zod'

/**
 * Type-safe environment configuration.
 *
 * Vite statically replaces `import.meta.env.VITE_*` at build time, so every key
 * must be referenced literally — a dynamic lookup would be inlined as
 * `undefined`. We validate once at module load and fail loudly on a bad build
 * rather than surfacing a confusing 404 at the first request.
 */

const booleanish = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1')

/** Accepts an absolute URL or a root-relative path such as `/api`. */
const baseUrl = z
  .string()
  .min(1)
  .refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), {
    message: 'must be an absolute http(s) URL or start with "/"',
  })
  // Normalise away a trailing slash so callers can always join with `/x`.
  .transform((v) => (v.length > 1 && v.endsWith('/') ? v.slice(0, -1) : v))

const envSchema = z.object({
  apiUrl: baseUrl,
  authUrl: baseUrl,
  appName: z.string().min(1),
  googleClientId: z.string().optional().transform((v) => v?.trim() || undefined),
  enableDevtools: booleanish,
})

export type AppEnv = z.infer<typeof envSchema> & {
  isDev: boolean
  isProd: boolean
}

const parsed = envSchema.safeParse({
  apiUrl: import.meta.env.VITE_API_URL ?? '/api',
  authUrl: import.meta.env.VITE_AUTH_URL ?? '/api/auth',
  appName: import.meta.env.VITE_APP_NAME ?? 'DOMIX',
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  enableDevtools: import.meta.env.VITE_ENABLE_DEVTOOLS ?? '',
})

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((i) => `  VITE_${i.path.join('.')}: ${i.message}`)
    .join('\n')
  throw new Error(`Invalid environment configuration:\n${detail}`)
}

export const env: AppEnv = {
  ...parsed.data,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}

/** True when Google sign-in is fully configured and can be offered to users. */
export const isGoogleAuthEnabled = Boolean(env.googleClientId)
