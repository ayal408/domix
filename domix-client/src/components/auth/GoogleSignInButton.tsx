import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme.store'
import { loadGoogleIdentityScript } from '@/lib/googleIdentity'

interface Props {
  clientId: string
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
export function GoogleSignInButton({ clientId, onIdToken, disabled }: Props) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const resolvedTheme = useThemeStore((state) => state.resolved)
  const onIdTokenRef = useRef(onIdToken)
  onIdTokenRef.current = onIdToken

  useEffect(() => {
    if (!clientId || disabled) return
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let resizeObserver: ResizeObserver | undefined
    setFailed(false)
    setLoading(true)

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !container || !window.google) return

        window.google.accounts.id.initialize({
          client_id: clientId,
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
          setLoading(false)
        }
        render()
        resizeObserver = new ResizeObserver(render)
        resizeObserver.observe(container)
      })
      .catch(() => {
        if (!cancelled) { setLoading(false); setFailed(true) }
      })

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
    }
  }, [clientId, disabled, resolvedTheme, i18n.language, attempt])

  if (!clientId) return null

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} className="flex min-h-10 w-full justify-center" style={{ colorScheme: 'light' }} />
      {loading && <p aria-live="polite" className="text-sm text-muted">{t('auth.googleLoading')}</p>}
      {failed && <><p role="alert" className="text-sm text-muted">{t('auth.googleUnavailable')}</p><button type="button" className="text-sm text-primary underline" onClick={() => setAttempt((value) => value + 1)}>{t('common.retry')}</button></>}
    </div>
  )
}
