import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as authApi from '@/api/auth.api'
import { useAuthStore } from '@/stores/auth.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

type State = 'verifying' | 'success' | 'error'

/** Landing page for the link emailed by `POST /auth/verify-email` — see UserService.SendVerificationEmailAsync. */
export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  // Session restore (App.tsx's bootstrap()) is async, so `status` may still be
  // 'initializing' on the first render — read it live, not from a value captured at mount, or a
  // signed-in visitor's `isEmailVerified` never gets refreshed and the verification banner never
  // clears even though the verify call itself succeeded.
  const status = useAuthStore((state) => state.status)
  const [state, setState] = useState<State>('verifying')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || status === 'initializing') return
    ran.current = true

    if (!token) {
      setState('error')
      setErrorMessage(t('auth.verifyEmail.missingToken'))
      return
    }

    authApi
      .verifyEmail({ token })
      .then(async () => {
        setState('success')
        if (useAuthStore.getState().status === 'authenticated') {
          await useAuthStore.getState().refreshProfile()
        }
      })
      .catch((error) => {
        setState('error')
        setErrorMessage(t(errorTranslationKey(error), toApiError(error).message))
      })
  }, [status, token, t])

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-8">
      <h1 className="text-center text-2xl font-bold text-foreground">{t('auth.verifyEmail.title')}</h1>
      <Card className="flex flex-col items-center gap-4 p-6 text-center">
        {state === 'verifying' && (
          <>
            <Spinner className="h-8 w-8 text-primary" />
            <p className="text-sm text-muted">{t('auth.verifyEmail.verifying')}</p>
          </>
        )}
        {state === 'success' && (
          <>
            <p className="text-sm font-medium text-foreground">{t('auth.verifyEmail.success')}</p>
            <Link to="/" className="text-sm font-medium text-primary hover:underline">
              {t('auth.verifyEmail.continue')}
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <p role="alert" className="text-sm font-medium text-danger">
              {errorMessage}
            </p>
            <Link to="/login" className="text-sm font-medium text-primary hover:underline">
              {t('auth.verifyEmail.backToLogin')}
            </Link>
          </>
        )}
      </Card>
    </div>
  )
}
