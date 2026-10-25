import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { InputField, TextareaField } from '@/components/ui/Field'
import { HebrewDateField } from '@/components/ui/HebrewDateField'
import { useExchangeRequests, useExchangeAction, exchangeError, type ExchangeAgreement } from './useExchangeWorkflow'
import { formatExchangeDate, todayIso, validExchangeDates } from './exchangeDates'

export default function ExchangeRequestsPage() {
  const { t } = useTranslation()
  const requests = useExchangeRequests()
  return <div className="flex flex-col gap-5"><h1 className="text-2xl font-bold">{t('hospitality.requests')}</h1>
    {requests.isPending ? <p role="status">{t('exchange.matching')}</p> : requests.isError ? <EmptyState title={t('hospitality.error')} action={<Button onClick={() => requests.refetch()}>{t('common.retry')}</Button>} /> : requests.data.length === 0 ? <EmptyState title={t('hospitality.emptyRequests')} action={<Link to="/exchange" className="text-primary underline">{t('exchange.find')}</Link>} /> : requests.data.map(request => <RequestCard key={`${request.id}-${request.revision}`} request={request} />)}
  </div>
}
function RequestCard({ request }: { request: ExchangeAgreement }) {
  const { t, i18n } = useTranslation()
  const userId = useAuthStore(s => s.user?.userId)
  const action = useExchangeAction()
  const [ownGuests, setOwnGuests] = useState(request.recipientGuests ?? 1)
  const [score, setScore] = useState('5')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [counter, setCounter] = useState(false)
  const [start, setStart] = useState(request.start)
  const [end, setEnd] = useState(request.end)
  const [guests, setGuests] = useState(request.guests)
  const [note, setNote] = useState('')
  const incoming = request.recipientId === userId
  async function decide(decision: string) {
    if (decision === 'Accept' && (!Number.isInteger(ownGuests) || ownGuests < 1 || ownGuests > 30)) { setError(t('hospitality.capacityError')); return }
    const key = decision === 'Accept' ? 'acceptConfirm' : decision === 'Decline' ? 'declineConfirm' : decision === 'Cancel' ? 'cancelConfirm' : 'completeConfirm'
    if (!window.confirm(t(`hospitality.${key}`))) return
    try { setError(''); await action.mutateAsync({ url: `/exchange/requests/${request.id}/decision`, body: { action: decision, revision: request.revision, recipientGuests: ownGuests } }) }
    catch (err) { setError(exchangeError(err, t('hospitality.error'))) }
  }
  return <Card className="flex flex-col gap-3 p-4">
    <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{t(incoming ? 'hospitality.incoming' : 'hospitality.outgoing')}</h2><strong className="text-primary">{t(`hospitality.status.${request.status}`)}</strong></div>
    <p>{t('hospitality.offered')}: <Link className="text-primary underline" to={`/apartments/${request.offeredApartmentId}`}>{request.offeredHome}</Link></p>
    <p>{t('hospitality.requested')}: <Link className="text-primary underline" to={`/apartments/${request.requestedApartmentId}`}>{request.requestedHome}</Link></p>
    <p>{formatExchangeDate(request.start, i18n.language)} — {formatExchangeDate(request.end, i18n.language)}</p>
    <p>{t('hospitality.guests')}: {request.guests}</p>
    {request.note && <p className="whitespace-pre-line text-sm">{request.note}</p>}
    {request.recipientGuests != null && <p>{t('hospitality.otherGuests')}: {request.recipientGuests}</p>}
    {incoming && request.status === 'Pending' && <InputField label={t('hospitality.yourGuests')} type="number" min={1} max={30} value={ownGuests} onChange={event => setOwnGuests(Number(event.target.value))} />}
    {request.status === 'Accepted' && request.end <= todayIso() && <>
      {(incoming ? request.recipientCompletedAt : request.requesterCompletedAt) ? <p role="status">{t('hospitality.completionWaiting')}</p> : <Button onClick={() => decide('Complete')} disabled={action.isPending}>{t('hospitality.complete')}</Button>}
    </>}
    {request.status === 'Completed' && !request.hasReviewed && <form className="grid gap-3 rounded border border-border p-3" onSubmit={async event => {
      event.preventDefault(); try { setError(''); await action.mutateAsync({ url: `/exchange/requests/${request.id}/review`, body: { score: Number(score), comment } }) } catch (err) { setError(exchangeError(err, t('hospitality.error'))) }
    }}>
      <h3 className="font-semibold">{t('hospitality.review')}</h3>
      <InputField type="number" min={1} max={5} required label={t('hospitality.score')} value={score} onChange={event => setScore(event.target.value)} />
      <TextareaField label={t('hospitality.reviewComment')} value={comment} maxLength={1000} onChange={event => setComment(event.target.value)} />
      <p className="text-sm text-muted">{t('hospitality.consentReview')}</p>
      <Button type="submit" loading={action.isPending}>{t('hospitality.reviewSend')}</Button>
    </form>}
    {request.hasReviewed && <p>{t('hospitality.reviewed')}</p>}
    <div className="flex flex-wrap gap-2">
      {request.status === 'Pending' && incoming && <><Button loading={action.isPending} onClick={() => decide('Accept')}>{t('hospitality.accept')}</Button><Button variant="secondary" disabled={action.isPending} onClick={() => decide('Decline')}>{t('hospitality.decline')}</Button></>}
      {request.status === 'Pending' && <Button variant="secondary" onClick={() => setCounter(!counter)} disabled={action.isPending}>{t('hospitality.counter')}</Button>}
      {['Pending', 'Accepted'].includes(request.status) && request.end > todayIso() && <Button variant="danger" disabled={action.isPending} onClick={() => decide('Cancel')}>{t('hospitality.cancel')}</Button>}
    </div>
    {counter && <form className="grid gap-3 rounded border border-border p-3 sm:grid-cols-2" onSubmit={async event => {
      event.preventDefault(); if (!validExchangeDates(start, end)) { setError(t('exchange.datesInvalid')); return }
      try { setError(''); await action.mutateAsync({ url: `/exchange/requests/${request.id}/counter`, body: { revision: request.revision, start, end, guests, note } }); setCounter(false) }
      catch (err) { setError(exchangeError(err, t('hospitality.error'))) }
    }}>
      <p className="text-sm sm:col-span-2">{t('hospitality.counterHint')}</p>
      <HebrewDateField name={`counterStart-${request.id}`} label={t('exchange.from')} value={start} minDate={todayIso()} onChange={setStart} required />
      <HebrewDateField name={`counterEnd-${request.id}`} label={t('exchange.to')} value={end} minDate={start} onChange={setEnd} required />
      <InputField label={t('hospitality.guests')} type="number" min={1} max={30} value={guests} onChange={event => setGuests(Number(event.target.value))} required />
      <TextareaField label={t('hospitality.note')} value={note} maxLength={2000} onChange={event => setNote(event.target.value)} />
      <Button loading={action.isPending} type="submit">{t('hospitality.send')}</Button>
    </form>}
    {error && <p className="text-sm text-danger" role="alert">{error}</p>}
  </Card>
}
