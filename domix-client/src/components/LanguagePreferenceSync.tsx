import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { dataClient } from '@/api/http'
import { useAuthStore } from '@/stores/auth.store'

/** Store the selected interface language for emails sent after the browser closes. */
export function LanguagePreferenceSync() {
  const { i18n } = useTranslation()
  const userId = useAuthStore((s) => s.status === 'authenticated' ? s.user?.userId : undefined)
  const language = i18n.resolvedLanguage ?? 'he'
  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    void dataClient.put('/preferences/language', { language }, { signal: controller.signal }).catch(() => {
      // A temporarily unavailable preference endpoint must not interrupt the session.
    })
    return () => controller.abort()
  }, [userId, language])
  return null
}
