import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { registerSchema, type RegisterFormValues } from '@/features/auth/schemas'
import { useAuthStore } from '@/stores/auth.store'
import { InputField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { isGoogleAuthEnabled } from '@/config/env'
import { errorTranslationKey, toApiError } from '@/api/errors'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signUp = useAuthStore((state) => state.signUp)
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const [formError, setFormError] = useState<string | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)

  async function handleGoogleIdToken(idToken: string) {
    setGoogleError(null)
    try {
      await signInWithGoogle(idToken)
      navigate('/', { replace: true })
    } catch (error) {
      const apiError = toApiError(error)
      setGoogleError(t(errorTranslationKey(error), apiError.message))
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null)
    try {
      await signUp({
        userName: values.userName,
        email: values.email,
        password: values.password,
        ...(values.phone ? { phone: values.phone } : {}),
      })
      navigate('/', { replace: true })
    } catch (error) {
      const apiError = toApiError(error)
      setFormError(t(errorTranslationKey(error), apiError.message))
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-8">
      <h1 className="text-center text-2xl font-bold text-foreground">{t('auth.registerTitle')}</h1>
      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <InputField
            label={t('auth.username')}
            autoComplete="username"
            required
            error={errors.userName?.message}
            {...register('userName')}
          />
          <InputField
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <InputField label={t('auth.phone')} type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
          <InputField
            label={t('auth.password')}
            type="password"
            autoComplete="new-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />
          <InputField
            label={t('auth.confirmPassword')}
            type="password"
            autoComplete="new-password"
            required
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          {formError && (
            <p role="alert" className="text-sm font-medium text-danger">
              {formError}
            </p>
          )}
          <Button type="submit" loading={isSubmitting} className="mt-2">
            {t('auth.registerButton')}
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
      </Card>
      <p className="text-center text-sm text-muted">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.signInInstead')}
        </Link>
      </p>
    </div>
  )
}
