import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/features/auth/schemas'
import * as authApi from '@/api/auth.api'
import { InputField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const pushToast = useToastStore((state) => state.push)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) })

  async function onSubmit(values: ResetPasswordFormValues) {
    setFormError(null)
    if (!token) {
      setFormError(t('auth.verifyEmail.missingToken'))
      return
    }
    try {
      await authApi.resetPassword({ token, newPassword: values.password })
      pushToast({ variant: 'success', title: t('auth.resetPassword.success') })
      navigate('/login', { replace: true })
    } catch (error) {
      const apiError = toApiError(error)
      setFormError(t(errorTranslationKey(error), apiError.message))
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-8">
      <h1 className="text-center text-2xl font-bold text-foreground">{t('auth.resetPassword.title')}</h1>
      <Card className="p-6">
        {!token ? (
          <p role="alert" className="text-center text-sm font-medium text-danger">
            {t('auth.verifyEmail.missingToken')}
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <InputField
              label={t('auth.resetPassword.newPassword')}
              type="password"
              autoComplete="new-password"
              required
              error={errors.password?.message}
              {...register('password')}
            />
            <InputField
              label={t('auth.resetPassword.confirmPassword')}
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
              {t('auth.resetPassword.submit')}
            </Button>
          </form>
        )}
      </Card>
      <p className="text-center text-sm text-muted">
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.verifyEmail.backToLogin')}
        </Link>
      </p>
    </div>
  )
}
