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
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const resolvedTheme = useThemeStore((state) => state.resolved)
  const onIdTokenRef = useRef(onIdToken)
  onIdTokenRef.current = onIdToken

  useEffect(() => {
    if (!isGoogleAuthEnabled || disabled) return
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let resizeObserver: ResizeObserver | undefined
    setFailed(false)

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !container || !window.google) return

        window.google.accounts.id.initialize({
          client_id: env.googleClientId!,
          callback: (response) => onIdTokenRef.current(response.credential),
        })

        let lastWidth = 0
        const render = () => {
          if (cancelled || !window.google) return
          const width = Math.min(400, Math.floor(container.clientWidth))
          if (!width || width === lastWidth) return
          lastWidth = width
          container.innerHTML = ''
          window.google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width,
          locale: i18n.language,
          })
        }
        render()
        resizeObserver = new ResizeObserver(render)
        resizeObserver.observe(container)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
    }
  }, [disabled, resolvedTheme, i18n.language, attempt])

  if (!isGoogleAuthEnabled) return null

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} className="flex w-full justify-center" style={{ colorScheme: 'light' }} />
      {failed && <><p role="alert" className="text-sm text-muted">{t('auth.googleUnavailable')}</p><button type="button" className="text-sm text-primary underline" onClick={() => setAttempt((value) => value + 1)}>{t('common.retry')}</button></>}
    </div>
  )
}
