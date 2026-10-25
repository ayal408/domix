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
import { InputField, SelectField } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import type { Apartment } from '@/types/api'

export interface ExchangeMatch { apartment: Apartment; isMutual: boolean }

export default function ExchangePage() {
  const { t, i18n } = useTranslation()
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
  const offerCovers = !!offer?.availableFrom && !!offer.availableTo && offer.availableFrom <= start && offer.availableTo >= end
  const ready = !!destination.trim() && destination.length <= 100 && datesValid && offerCovers
  // Delay network requests while typing, and do not display results from stale parameters.
  const request = { destination: destination.trim(), start, end, offeredApartmentId }
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
      </form>
      {offer && <p className="text-sm text-muted">{t('exchange.offerPeriod', { from: formatExchangeDate(offer.availableFrom, i18n.language), to: formatExchangeDate(offer.availableTo, i18n.language) })}</p>}
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
