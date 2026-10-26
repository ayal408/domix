import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { dataClient } from '@/api/http'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { queryClient } from '@/api/queryClient'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function PrivacyControls() {
  const { t } = useTranslation('privacy')
  const user = useAuthStore(state => state.user)
  const refreshProfile = useAuthStore(state => state.refreshProfile)
  const toast = useToastStore(state => state.push)
  const [busy, setBusy] = useState(false)
  async function sharePhone(value: boolean) {
    setBusy(true)
    try {
      await dataClient.patch('/privacy/contact-preferences', { sharePhone: value })
      await refreshProfile()
      await queryClient.invalidateQueries({ queryKey: ['listing-contact'] })
    } catch { toast({ variant: 'error', title: t('failed') }) }
    finally { setBusy(false) }
  }
  async function download() {
    setBusy(true)
    try {
      const { data } = await dataClient.get('/privacy/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = 'domix-personal-data.json'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { toast({ variant: 'error', title: t('failed') }) }
    finally { setBusy(false) }
  }
  return <Card className="flex flex-col gap-3 p-6">
    <h2 className="font-semibold">{t('controls')}</h2>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={user?.sharePhone ?? false} disabled={busy} onChange={e => void sharePhone(e.target.checked)} />{t('sharePhone')}</label>
    <Button variant="secondary" disabled={busy} onClick={() => void download()}>{t('export')}</Button>
    <p className="text-xs text-muted">{t('exportNotice')}</p>
    <Link to="/privacy" className="text-sm text-primary underline">{t('requests')}</Link>
  </Card>
}
