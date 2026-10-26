import { useQuery } from '@tanstack/react-query'
import { dataClient } from '@/api/http'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateSupportTicket } from '@/hooks/useSupport'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/Button'

export default function PrivacyPage() {
  const { t } = useTranslation('privacy')
  const { data: info } = useQuery({ queryKey: ['privacy-info'], queryFn: async () => (await dataClient.get<{ operatorName?: string; contactEmail?: string; resolvedSupportRetentionDays: number; deliveryContentRetentionDays: number; archivedListingContentRetentionDays: number }>('/privacy/info')).data })
  const user = useAuthStore(state => state.user)
  const ticket = useCreateSupportTicket()
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  return <article className="mx-auto flex max-w-2xl flex-col gap-5 text-start">
    <h1 className="text-2xl font-bold">{t('title')}</h1>
    {info?.operatorName && <p className="text-sm">{t('operator')}: {info.operatorName}</p>}
    {info?.contactEmail && <p className="text-sm">{t('email')}: {info.contactEmail}</p>}
    {info && <section className="text-sm"><h2 className="font-semibold">{t('configuredRetention')}</h2>
      {(['resolvedSupportRetentionDays', 'deliveryContentRetentionDays', 'archivedListingContentRetentionDays'] as const).map(key => <p key={key}>{t(key)}: {info[key] > 0 ? t('days', { count: info[key] }) : t('noTimedPurge')}</p>)}
    </section>}
    {['purpose', 'collection', 'visibility', 'anonymous', 'vendors', 'retention', 'deletion', 'children'].map(key => <section key={key}><h2 className="font-semibold">{t(`${key}Title`)}</h2><p className="mt-1 text-sm leading-7 text-muted">{t(key)}</p></section>)}
    <form className="flex flex-col gap-3 rounded border border-border p-4" onSubmit={e => { e.preventDefault(); ticket.mutate({ message: `[Privacy request] ${message}`, contactEmail: user ? undefined : email, includeTranscript: false }, { onSuccess: () => setMessage('') }) }}>
      <h2 className="font-semibold">{t('requests')}</h2><p className="text-sm text-muted">{t('requestNotice')}</p>
      {!user && <input aria-label={t('email')} type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="rounded border border-border bg-background p-2" />}
      <textarea aria-label={t('requests')} required maxLength={7000} value={message} onChange={e => setMessage(e.target.value)} className="min-h-28 rounded border border-border bg-background p-2" />
      <Button type="submit" loading={ticket.isPending}>{t('send')}</Button>
      {ticket.isSuccess && <p role="status">{t('sent')}</p>}{ticket.isError && <p role="alert">{t('failed')}</p>}
    </form>
  </article>
}
