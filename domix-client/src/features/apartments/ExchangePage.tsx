import { useState } from 'react'
import { useExchangeAction, exchangeError } from './useExchangeWorkflow'
import { HebrewDateField } from '@/components/ui/HebrewDateField'
import { validExchangeDates, todayIso, formatExchangeDate } from './exchangeDates'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { dataClient } from '@/api/http'
import { useApartments } from '@/hooks/useApartments'
import { useAuthStore } from '@/stores/auth.store'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { ApartmentCard } from './ApartmentCard'
import { InputField, SelectField, CheckboxField } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import type { Apartment } from '@/types/api'

export interface ExchangeMatch { apartment: Apartment; isMutual: boolean }

export default function ExchangePage() {
  const { t, i18n } = useTranslation()
  const [frequency, setFrequency] = useState('Off')
  const [watchMessage, setWatchMessage] = useState('')
  const watchAction = useExchangeAction()
  const [params, setParams] = useSearchParams()
  const userId = useAuthStore(s => s.user?.userId)
  const listings = useApartments()
  const offers = useMemo(() => (listings.data ?? []).filter(a => a.userId === userId && a.listingType === 'Exchange' && a.status === 'Available'), [listings.data, userId])
  const destination = params.get('destination') ?? ''
  const start = params.get('start') ?? ''
  const end = params.get('end') ?? ''
  const offeredApartmentId = params.get('offeredApartmentId') ?? ''
  const offer = offers.find(a => a.apartmentId === offeredApartmentId)
  const today = todayIso()
  const datesValid = validExchangeDates(start, end, today)
  // The server calendar is authoritative; additional windows can extend base availability.
  const offerCovers = !!offer
  const ready = !!destination.trim() && destination.length <= 100 && datesValid && offerCovers
  // Delay network requests while typing, and do not display results from stale parameters.
  const guests = params.get('guests') ?? ''
  const kosherKitchen = params.get('kosherKitchen') === 'true'
  const separateBeds = params.get('separateBeds') === 'true'
  const maxSynagogueDistance = params.get('maxSynagogueDistance') ?? ''
  const request = { destination: destination.trim(), start, end, offeredApartmentId,
    ...(guests ? { guests: Number(guests) } : {}), ...(kosherKitchen ? { kosherKitchen: true } : {}),
    ...(separateBeds ? { separateBeds: true } : {}), ...(maxSynagogueDistance ? { maxSynagogueDistance: Number(maxSynagogueDistance) } : {}) }

  const signature = JSON.stringify(request)
  const debouncedSignature = useDebouncedValue(signature, 400)
  const matches = useQuery({
    queryKey: ['apartments', 'exchange', userId, debouncedSignature],
    queryFn: async ({ signal }) => {
      const { data } = await dataClient.get<ExchangeMatch[]>('/exchange/matches', { params: JSON.parse(debouncedSignature), signal })
      return data
    },
    enabled: ready && signature === debouncedSignature,
    retry: false,
  })
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (key === 'offeredApartmentId') {
      const selected = offers.find(a => a.apartmentId === value)
      if (selected) {
        if (selected.desiredCity) next.set('destination', selected.desiredCity)
        if (selected.availableFrom) next.set('start', selected.availableFrom)
        if (selected.availableTo) next.set('end', selected.availableTo)
      }
    }
    setParams(next, { replace: true })
  }
  return <div className="flex flex-col gap-6">
    <nav className="flex flex-wrap gap-3"><Link className="text-primary underline" to="/exchange/watches">{t('hospitality.watches')}</Link><Link className="text-primary underline" to="/exchange/requests">{t('hospitality.requests')}</Link><Link className="text-primary underline" to="/exchange/calendar">{t('hospitality.calendar')}</Link></nav>
    <div><h1 className="text-2xl font-bold">{t('exchange.title')}</h1><p className="mt-2 text-muted">{t('exchange.intro')}</p></div>
    {listings.isError ? <EmptyState title={t('apartments.loadError')} action={<Button onClick={() => listings.refetch()}>{t('common.retry')}</Button>} /> : listings.isLoading ? <p role="status">{t('exchange.matching')}</p> : offers.length === 0 ? <EmptyState title={t('exchange.noOffer')} action={<Link className="text-primary underline" to="/my-apartments">{t('exchange.publish')}</Link>} /> : <>
      <form onSubmit={e => e.preventDefault()} className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <SelectField label={t('exchange.offer')} value={offeredApartmentId} onChange={e => change('offeredApartmentId', e.target.value)}>
          <option value="">{t('exchange.selectOffer')}</option>
          {offers.map(a => <option key={a.apartmentId} value={a.apartmentId}>{a.city} · {a.address}</option>)}
        </SelectField>
        <InputField list="exchange-destinations" label={t('exchange.destination')} value={destination} maxLength={100} onChange={e => change('destination', e.target.value)} />
        <datalist id="exchange-destinations">{[...new Set((listings.data ?? []).map(a => a.city))].sort().map(city => <option key={city} value={city} />)}</datalist>
        <HebrewDateField name="start" minDate={today} label={t('exchange.from')} value={start} onChange={value => change('start', value)} />
        <HebrewDateField name="end" minDate={start || today} label={t('exchange.to')} value={end} onChange={value => change('end', value)} />
        <fieldset className="grid gap-3 rounded border border-border p-3 sm:col-span-2 sm:grid-cols-2">
          <legend>{t('hospitality.filters')}</legend>
          <InputField type="number" min={1} max={30} label={t('hospitality.guests')} value={guests} onChange={event => change('guests', event.target.value)} />
          <InputField type="number" min={0} max={10000} label={t('hospitality.maxSynagogue')} value={maxSynagogueDistance} onChange={event => change('maxSynagogueDistance', event.target.value)} />
          <CheckboxField label={t('hospitality.kosherKitchen')} checked={kosherKitchen} onChange={event => change('kosherKitchen', event.target.checked ? 'true' : '')} />
          <CheckboxField label={t('hospitality.separateBeds')} checked={separateBeds} onChange={event => change('separateBeds', event.target.checked ? 'true' : '')} />
          <p className="text-sm text-muted sm:col-span-2">{t('hospitality.filtersHint')}</p>
        </fieldset>
      </form>
      {offer && <p className="text-sm text-muted">{t('exchange.offerPeriod', { from: formatExchangeDate(offer.availableFrom, i18n.language), to: formatExchangeDate(offer.availableTo, i18n.language) })}</p>}
      {ready && <form className="flex flex-wrap items-end gap-3 rounded border border-border bg-card p-3" onSubmit={async event => {
        event.preventDefault(); try { await watchAction.mutateAsync({ url: '/exchange/watches', body: { ...request, frequency } }); setWatchMessage(t('hospitality.watchSaved')) } catch (err) { setWatchMessage(exchangeError(err, t('hospitality.error'))) }
      }}><SelectField label={t('hospitality.frequency')} value={frequency} onChange={event => setFrequency(event.target.value)}>{['Off', 'Immediate', 'Daily', 'Weekly'].map(value => <option key={value} value={value}>{t(`hospitality.frequencies.${value}`)}</option>)}</SelectField><Button type="submit" loading={watchAction.isPending}>{t('hospitality.watchSave')}</Button><p className="text-sm text-muted">{t('hospitality.watchHint')}</p>{watchMessage && <p role="status">{watchMessage}</p>}</form>}
      <div aria-live="polite">
        {!ready ? <p>{start && end && !datesValid ? t('exchange.datesInvalid') : offer && datesValid && !offerCovers ? t('exchange.offerUnavailable') : t('exchange.ready')}</p> : signature !== debouncedSignature || matches.isPending ? <p role="status">{t('exchange.matching')}</p> : matches.isError ? <EmptyState title={t('exchange.loadError')} action={<Button onClick={() => matches.refetch()}>{t('common.retry')}</Button>} /> : <>
          <h2 className="mb-4 text-lg font-semibold">{t('exchange.results', { count: matches.data?.length ?? 0 })}</h2>
          {matches.data?.length === 0 ? <EmptyState title={t('exchange.none')} /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{matches.data?.map(match => <div className="flex flex-col gap-2" key={match.apartment.apartmentId}><p className={match.isMutual ? 'font-medium text-primary' : 'text-sm text-muted'}>{t(match.isMutual ? 'exchange.mutual' : 'exchange.possible')}</p><ApartmentCard apartment={match.apartment} /></div>)}</div>}
        </>}
      </div>
    </>}
    <p className="text-sm text-muted">{t('exchange.disclaimer')}</p>
  </div>
}
