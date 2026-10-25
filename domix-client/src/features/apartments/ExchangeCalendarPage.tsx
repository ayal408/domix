import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApartments } from '@/hooks/useApartments'
import { useAuthStore } from '@/stores/auth.store'
import { HebrewDateField } from '@/components/ui/HebrewDateField'
import { SelectField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useExchangeCalendar, useExchangeAction, exchangeError } from './useExchangeWorkflow'
import { formatExchangeDate, todayIso, validExchangeDates } from './exchangeDates'

export default function ExchangeCalendarPage() {
  const { t, i18n } = useTranslation()
  const userId = useAuthStore(s => s.user?.userId)
  const homes = useApartments()
  const offers = (homes.data ?? []).filter(a => a.userId === userId && a.listingType === 'Exchange')
  const [homeId, setHome] = useState('')
  const calendar = useExchangeCalendar(homeId)
  const action = useExchangeAction()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [isAvailable, setAvailable] = useState('true')
  const [error, setError] = useState('')
  return <div className="flex flex-col gap-5">
    <h1 className="text-2xl font-bold">{t('hospitality.calendar')}</h1>
    <p className="text-sm text-muted">{t('hospitality.calendarHint')}</p>
    {homes.isError && <EmptyState title={t('apartments.loadError')} action={<Button onClick={() => homes.refetch()}>{t('common.retry')}</Button>} />}
    <SelectField label={t('exchange.offer')} value={homeId} onChange={event => { setHome(event.target.value); setError('') }}><option value="">{t('exchange.selectOffer')}</option>{offers.map(a => <option key={a.apartmentId} value={a.apartmentId}>{a.city} · {a.address}</option>)}</SelectField>
    {homeId && <>
      <form className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2" onSubmit={async event => {
        event.preventDefault(); if (!validExchangeDates(start, end)) { setError(t('exchange.datesInvalid')); return }
        try { setError(''); await action.mutateAsync({ url: `/exchange/calendar/${homeId}`, body: { start, end, isAvailable: isAvailable === 'true' } }); setStart(''); setEnd('') }
        catch (err) { setError(exchangeError(err, t('hospitality.error'))) }
      }}>
        <SelectField label={t('hospitality.periodType')} value={isAvailable} onChange={event => setAvailable(event.target.value)}><option value="true">{t('hospitality.available')}</option><option value="false">{t('hospitality.blocked')}</option></SelectField>
        <div />
        <HebrewDateField name="calendarStart" label={t('exchange.from')} minDate={todayIso()} value={start} onChange={setStart} required />
        <HebrewDateField name="calendarEnd" label={t('exchange.to')} minDate={start || todayIso()} value={end} onChange={setEnd} required />
        <Button type="submit" loading={action.isPending}>{t('hospitality.addPeriod')}</Button>
      </form>
      {calendar.isPending ? <p role="status">{t('exchange.matching')}</p> : calendar.isError ? <EmptyState title={t('hospitality.error')} action={<Button onClick={() => calendar.refetch()}>{t('common.retry')}</Button>} /> : <>
        {calendar.data.periods.length === 0 && <p>{t('hospitality.calendarEmpty')}</p>}
        <ul className="flex flex-col gap-2">{calendar.data.periods.map(period => <li key={period.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-card p-3"><span>{t(period.isAvailable ? 'hospitality.available' : 'hospitality.blocked')}: {formatExchangeDate(period.start, i18n.language)} — {formatExchangeDate(period.end, i18n.language)}</span><Button variant="secondary" size="sm" disabled={action.isPending} onClick={async () => {
          try { setError(''); await action.mutateAsync({ url: `/exchange/calendar/periods/${period.id}`, method: 'DELETE' }) } catch (err) { setError(exchangeError(err, t('hospitality.error'))) }
        }}>{t('hospitality.removePeriod')}</Button></li>)}</ul>
        <ul className="flex flex-col gap-2">{calendar.data.reservations.map(period => <li key={period.id} className="rounded border border-primary bg-card p-3">{t('hospitality.reserved')}: {formatExchangeDate(period.start, i18n.language)} — {formatExchangeDate(period.end, i18n.language)}</li>)}</ul>
      </>}
    </>}
    {error && <p role="alert" className="text-danger">{error}</p>}
  </div>
}
