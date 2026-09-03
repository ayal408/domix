import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/features/auth/schemas'
import * as authApi from '@/api/auth.api'
import { InputField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { errorTranslationKey, toApiError } from '@/api/errors'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) })

  async function onSubmit(values: ForgotPasswordFormValues) {
    setFormError(null)
    try {
      await authApi.forgotPassword(values)
      setSent(true)
    } catch (error) {
      const apiError = toApiError(error)
      setFormError(t(errorTranslationKey(error), apiError.message))
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-8">
      <h1 className="text-center text-2xl font-bold text-foreground">{t('auth.forgotPassword.title')}</h1>
      <Card className="p-6">
        {sent ? (
          <p className="text-center text-sm text-foreground">{t('auth.forgotPassword.sent')}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <p className="text-sm text-muted">{t('auth.forgotPassword.description')}</p>
            <InputField
              label={t('auth.email')}
              type="email"
              autoComplete="email"
              required
              error={errors.email?.message}
              {...register('email')}
            />
            {formError && (
              <p role="alert" className="text-sm font-medium text-danger">
                {formError}
              </p>
            )}
            <Button type="submit" loading={isSubmitting} className="mt-2">
              {t('auth.forgotPassword.submit')}
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
