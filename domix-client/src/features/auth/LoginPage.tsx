import { authReturn } from '@/lib/authReturn'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas'
import { useAuthStore } from '@/stores/auth.store'
import { InputField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import './auth.design.i18n'
import './auth-design.css'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { isGoogleAuthEnabled } from '@/config/env'
import { errorTranslationKey, toApiError } from '@/api/errors'

export default function LoginPage() {
  const { t } = useTranslation()
  const { t: design } = useTranslation('authDesign')
  const navigate = useNavigate()
  const location = useLocation()
  const signInWithPassword = useAuthStore((state) => state.signInWithPassword)
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const [formError, setFormError] = useState<string | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)

  function redirectAfterSignIn() {
    navigate(authReturn(location.state), { replace: true })
  }

  async function handleGoogleIdToken(idToken: string) {
    setGoogleError(null)
    try {
      await signInWithGoogle(idToken)
      redirectAfterSignIn()
    } catch (error) {
      const apiError = toApiError(error)
      setGoogleError(t(errorTranslationKey(error), apiError.message))
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginFormValues) {
    setFormError(null)
    try {
      await signInWithPassword(values.userName, values.password)
      redirectAfterSignIn()
    } catch (error) {
      const apiError = toApiError(error)
      setFormError(t(errorTranslationKey(error), apiError.message))
    }
  }

  return (
    <section className="auth-entry" aria-labelledby="login-heading">
      <aside className="auth-entry-story">
        <span className="auth-entry-wordmark" dir="ltr">DOMIX<span>·</span></span>
        <div className="auth-entry-story-copy">
          <span className="auth-entry-eyebrow">{design('eyebrow')}</span>
          <h2>{design('headline')}</h2>
          <p>{design('description')}</p>
        </div>
        <svg className="auth-entry-houses" viewBox="0 0 440 230" fill="none" aria-hidden="true">
          <circle cx="345" cy="53" r="34" fill="#c4b5fd" fillOpacity=".25" />
          <path d="M20 215H420" stroke="#c4b5fd" strokeOpacity=".35" />
          <path d="M52 215V122L126 66L200 122V215" fill="#a78bfa" fillOpacity=".2" stroke="#c4b5fd" strokeWidth="2" />
          <path d="M179 215V85L273 18L367 85V215" fill="#c4b5fd" fillOpacity=".12" stroke="#ddd6fe" strokeWidth="2" />
          <path d="M158 99L273 18L388 99" stroke="#ede9fe" strokeWidth="3" strokeLinecap="round" />
          <path d="M39 132L126 66L213 132" stroke="#c4b5fd" strokeWidth="3" strokeLinecap="round" />
          <rect x="239" y="143" width="66" height="72" rx="32" fill="#ddd6fe" fillOpacity=".3" />
          <rect x="235" y="85" width="26" height="28" rx="5" fill="#e9d5ff" />
          <rect x="285" y="85" width="26" height="28" rx="5" fill="#e9d5ff" fillOpacity=".45" />
          <rect x="86" y="145" width="24" height="27" rx="4" fill="#ddd6fe" fillOpacity=".6" />
          <rect x="140" y="145" width="24" height="27" rx="4" fill="#ddd6fe" fillOpacity=".3" />
          <path d="M397 215V156M397 188C370 188 368 158 381 149C377 126 409 118 416 142C439 152 426 183 397 188Z" fill="#a7f3d0" fillOpacity=".55" stroke="#a7f3d0" strokeWidth="2" />
        </svg>
        <span className="auth-entry-story-note">{design('note')}</span>
      </aside>
      <div className="auth-entry-panel">
        <div className="auth-entry-form">
          <header className="auth-entry-heading">
            <span className="auth-entry-kicker">{design('welcome')}</span>
            <h1 id="login-heading">{t('auth.loginTitle')}</h1>
            <p>{design('subtitle')}</p>
          </header>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          <InputField
            label={t('auth.username')}
            autoComplete="username"
            required
            error={errors.userName?.message}
            {...register('userName')}
          />
          <InputField
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />
          <Link to="/forgot-password" className="-mt-2 w-fit text-sm font-medium text-primary hover:underline">
            {t('auth.forgotPassword.link')}
          </Link>
          {formError && (
            <p role="alert" className="text-sm font-medium text-danger">
              {formError}
            </p>
          )}
          <Button type="submit" loading={isSubmitting} className="mt-1 h-12 rounded-xl">
            {t('auth.loginButton')}
          </Button>
        </form>
        {isGoogleAuthEnabled && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase text-muted">{t('auth.orDivider')}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <GoogleSignInButton onIdToken={handleGoogleIdToken} />
            {googleError && (
              <p role="alert" className="text-center text-sm font-medium text-danger">
                {googleError}
              </p>
            )}
          </div>
        )}
      <p className="auth-entry-register text-center text-sm text-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/register" state={location.state} className="font-medium text-primary hover:underline">
          {t('auth.createOne')}
        </Link>
      </p>
        </div>
      </div>
    </section>
  )
}
