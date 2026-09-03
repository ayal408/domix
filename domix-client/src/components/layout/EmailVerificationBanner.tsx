import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import * as authApi from '@/api/auth.api'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { Button } from '@/components/ui/Button'

/** Shown app-wide for a signed-in user whose password account hasn't clicked the verification link yet. */
export function EmailVerificationBanner() {
  const { t } = useTranslation()
  const status = useAuthStore((state) => state.status)
  const isEmailVerified = useAuthStore((state) => state.user?.isEmailVerified)
  const pushToast = useToastStore((state) => state.push)
  const [isSending, setIsSending] = useState(false)

  if (status !== 'authenticated' || isEmailVerified !== false) return null

  async function handleResend() {
    setIsSending(true)
    try {
      await authApi.resendVerification()
      pushToast({ variant: 'success', title: t('auth.verificationBanner.sent') })
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-warning/40 bg-warning-bg px-4 py-2 text-center text-sm text-warning">
      <span>{t('auth.verificationBanner.message')}</span>
      <Button type="button" size="sm" variant="secondary" loading={isSending} onClick={handleResend}>
        {t('auth.verificationBanner.resend')}
      </Button>
    </div>
  )
}
