import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { env, isGoogleAuthEnabled } from '@/config/env'
import { useThemeStore } from '@/stores/theme.store'
import { loadGoogleIdentityScript } from '@/lib/googleIdentity'

interface Props {
  onIdToken: (idToken: string) => void
  disabled?: boolean
}

/**
 * Renders Google's own "Sign in with Google" button via Google Identity
 * Services and hands the resulting ID token up to the caller — LoginPage and
 * RegisterPage both exchange it for a DOMIX session through the same
 * `POST /auth/google` endpoint (see auth.api.ts `loginWithGoogle`).
 *
 * Google mints its own DOM inside the container div, so the button is themed
 * once at render time rather than styled through Tailwind.
 */
export function GoogleSignInButton({ onIdToken, disabled }: Props) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const resolvedTheme = useThemeStore((state) => state.resolved)
  const onIdTokenRef = useRef(onIdToken)
  onIdTokenRef.current = onIdToken

  useEffect(() => {
    if (!isGoogleAuthEnabled || disabled) return
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !container || !window.google) return

        window.google.accounts.id.initialize({
          client_id: env.googleClientId!,
          callback: (response) => onIdTokenRef.current(response.credential),
        })

        container.innerHTML = ''
        window.google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 300,
          locale: i18n.language,
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [disabled, resolvedTheme, i18n.language])

  if (!isGoogleAuthEnabled) return null

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} className="flex justify-center" />
      {failed && <p className="text-sm text-muted">{t('auth.googleUnavailable')}</p>}
    </div>
  )
}
