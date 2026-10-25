import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useApartments } from '@/hooks/useApartments'
import { useAuthStore } from '@/stores/auth.store'
import { HebrewDateField } from '@/components/ui/HebrewDateField'
import { InputField, SelectField, TextareaField, CheckboxField } from '@/components/ui/Field'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useExchangeAction, exchangeError } from './useExchangeWorkflow'
import { todayIso, validExchangeDates } from './exchangeDates'

export function ExchangeProposalForm({ requestedApartmentId, offeredId = '', initialStart = '', initialEnd = '' }: {
  requestedApartmentId: string; offeredId?: string; initialStart?: string; initialEnd?: string
}) {
  const { t } = useTranslation()
  const userId = useAuthStore(s => s.user?.userId)
  const homes = useApartments()
  const [offeredApartmentId, setOffer] = useState(offeredId)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [guests, setGuests] = useState(1)
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const action = useExchangeAction()
  const offers = (homes.data ?? []).filter(a => a.userId === userId && a.listingType === 'Exchange' && a.status === 'Available')
  return <Card className="flex flex-col gap-3 p-4">
    <h2 className="font-semibold">{t('hospitality.request')}</h2>
    {sent ? <div role="status"><p>{t('hospitality.sent')}</p><Link className="text-primary underline" to="/exchange/requests">{t('hospitality.viewRequests')}</Link></div> : <form className="grid gap-3 sm:grid-cols-2" onSubmit={async event => {
      event.preventDefault(); setError('')
      if (!consent || !offeredApartmentId || !validExchangeDates(start, end)) { setError(t('exchange.datesInvalid')); return }
      try { await action.mutateAsync({ url: '/exchange/requests', body: { offeredApartmentId, requestedApartmentId, start, end, guests, note } }); setSent(true) }
      catch (err) { setError(exchangeError(err, t('hospitality.error'))) }
    }}>
      <SelectField label={t('exchange.offer')} value={offeredApartmentId} required onChange={event => setOffer(event.target.value)}><option value="">{t('exchange.selectOffer')}</option>{offers.map(a => <option key={a.apartmentId} value={a.apartmentId}>{a.city} · {a.address}</option>)}</SelectField>
      <InputField label={t('hospitality.guests')} type="number" min={1} max={30} value={guests} required onChange={event => setGuests(Number(event.target.value))} />
      <HebrewDateField name="proposalStart" label={t('exchange.from')} value={start} minDate={todayIso()} required onChange={setStart} />
      <HebrewDateField name="proposalEnd" label={t('exchange.to')} value={end} minDate={start || todayIso()} required onChange={setEnd} />
      <div className="sm:col-span-2"><TextareaField label={t('hospitality.note')} value={note} maxLength={2000} onChange={event => setNote(event.target.value)} /></div>
      <div className="sm:col-span-2"><CheckboxField label={t('hospitality.consent')} checked={consent} required onChange={event => setConsent(event.target.checked)} /></div>
      {error && <p className="text-sm text-danger sm:col-span-2" role="alert">{error}</p>}
      <Button type="submit" loading={action.isPending} disabled={!consent || offers.length === 0}>{t('hospitality.send')}</Button>
      {offers.length === 0 && <Link className="text-primary underline" to="/my-apartments">{t('exchange.publish')}</Link>}
    </form>}
  </Card>
}
