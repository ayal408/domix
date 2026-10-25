import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dataClient } from '@/api/http'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { useExchangeAction, exchangeError } from './useExchangeWorkflow'

export function ExchangeTrustControls({ apartmentId, ownerId }: { apartmentId: string; ownerId: string }) {
  const { t } = useTranslation()
  const userId = useAuthStore(s => s.user?.userId)
  const [showReport, setReport] = useState(false)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const action = useExchangeAction()
  const blocks = useQuery({ queryKey: ['exchange', 'blocks', userId], enabled: !!userId,
    queryFn: async ({ signal }) => (await dataClient.get<{ blockedUserId: string }[]>('/exchange/blocks', { signal })).data })
  if (!userId || userId === ownerId) return null
  const blocked = blocks.data?.some(x => x.blockedUserId === ownerId)
  return <section className="flex flex-col gap-3 rounded border border-border p-4">
    <p className="text-sm text-muted">{t('hospitality.blockHint')}</p>
    <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={action.isPending || !blocks.isSuccess} onClick={async () => {
      if (!window.confirm(t(blocked ? 'hospitality.unblock' : 'hospitality.block'))) return
      try { await action.mutateAsync({ url: `/exchange/blocks/${ownerId}`, method: blocked ? 'DELETE' : 'POST' }); setMessage(t('hospitality.saved')) } catch (err) { setMessage(exchangeError(err, t('hospitality.error'))) }
    }}>{t(blocked ? 'hospitality.unblock' : 'hospitality.block')}</Button><Button variant="secondary" onClick={() => setReport(!showReport)}>{t('hospitality.report')}</Button></div>
    {showReport && <form className="flex flex-col gap-3" onSubmit={async event => {
      event.preventDefault(); try { await action.mutateAsync({ url: '/exchange/reports', body: { apartmentId, reason } }); setReport(false); setReason(''); setMessage(t('hospitality.reported')) } catch (err) { setMessage(exchangeError(err, t('hospitality.error'))) }
    }}><TextareaField label={t('hospitality.reason')} value={reason} required maxLength={2000} onChange={event => setReason(event.target.value)} /><Button type="submit" loading={action.isPending}>{t('hospitality.report')}</Button></form>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>
}
export function ExchangeReviews({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const reviews = useQuery({ queryKey: ['exchange', 'reviews', userId], queryFn: async ({ signal }) => (await dataClient.get<{ id: string; score: number; comment: string }[]>(`/exchange/reviews/${userId}`, { signal })).data })
  return <section className="flex flex-col gap-2"><h3 className="text-sm font-semibold">{t('hospitality.verifiedReviews')}</h3>
    {reviews.isError ? <Button onClick={() => reviews.refetch()} variant="secondary">{t('common.retry')}</Button> : reviews.isPending ? <p>{t('exchange.matching')}</p> : reviews.data.length === 0 ? <p className="text-sm text-muted">{t('hospitality.noReviews')}</p> : reviews.data.map(review => <div key={review.id} className="border-t border-border py-2"><span aria-label={`${t('hospitality.score')}: ${review.score}`}>{review.score} / 5</span><p className="whitespace-pre-line text-sm">{review.comment}</p></div>)}
  </section>
}
