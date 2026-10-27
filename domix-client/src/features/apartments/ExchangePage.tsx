import { HebrewDateField } from '@/components/ui/HebrewDateField'
import { validExchangeDates, todayIso, formatExchangeDate } from './exchangeDates'
import { useMemo } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
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
  const location = useLocation()
  const status = useAuthStore(s => s.status)
  const userId = useAuthStore(s => s.user?.userId)
  const authenticated = status === 'authenticated'
  const listings = useApartments(authenticated)
  const offers = useMemo(() => (listings.data ?? []).filter(a => a.userId === userId && a.listingType === 'Exchange' && (a.status === 'Available' || a.status === 'Negotiating')), [listings.data, userId])
  const destination = params.get('destination') ?? ''
  const start = params.get('start') ?? ''
  const end = params.get('end') ?? ''
  const offeredApartmentId = params.get('offeredApartmentId') ?? ''
  const offer = offers.find(a => a.apartmentId === offeredApartmentId)
  const preview = !offeredApartmentId
  const today = todayIso()
  const datesValid = validExchangeDates(start, end, today)
  const offerCovers = !!offer?.availableFrom && !!offer.availableTo && offer.availableFrom <= start && offer.availableTo >= end
  const ready = !!destination.trim() && destination.length <= 100 && datesValid && (preview || offerCovers)
  const request = { destination: destination.trim(), start, end, ...(preview ? {} : { offeredApartmentId }) }
  const signature = JSON.stringify(request)
  const debouncedSignature = useDebouncedValue(signature, 400)
  const matches = useQuery({
    queryKey: ['apartments', 'exchange', preview ? 'preview' : 'matches', userId, debouncedSignature],
    queryFn: async ({ signal }) => {
      const { data } = await dataClient.get<ExchangeMatch[]>(preview ? '/exchange/preview' : '/exchange/matches', { params: JSON.parse(debouncedSignature), signal })
      return data
    },
    enabled: authenticated && ready && signature === debouncedSignature,
    retry: false,
  })
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (key === 'offeredApartmentId') {
      const selected = offers.find(a => a.apartmentId === value)
      if (selected) {
        // Keep the user's draft; only prefill missing fields from the published home.
        if (!next.get('destination') && selected.desiredCity) next.set('destination', selected.desiredCity)
        if (!next.get('start') && selected.availableFrom) next.set('start', selected.availableFrom)
        if (!next.get('end') && selected.availableTo) next.set('end', selected.availableTo)
      }
    }
    setParams(next, { replace: true })
  }
  if (status === 'initializing') return <p role="status">{t('exchange.matching')}</p>
  return <div className="flex flex-col gap-6">
    <div><h1 className="text-2xl font-bold">{t('exchange.title')}</h1><p className="mt-2 text-muted">{t('discovery.promise')}</p></div>
    <form id="exchange-search" onSubmit={e => e.preventDefault()} className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
      <InputField list="exchange-destinations" label={t('exchange.destination')} value={destination} maxLength={100} onChange={e => change('destination', e.target.value)} />
      <datalist id="exchange-destinations">{authenticated && [...new Set((listings.data ?? []).map(a => a.city))].sort().map(city => <option key={city} value={city} />)}</datalist>
      {authenticated && <SelectField label={t('exchange.offer')} value={offeredApartmentId} onChange={e => change('offeredApartmentId', e.target.value)}>
        <option value="">{t('discovery.previewOption')}</option>
        {offers.map(a => <option key={a.apartmentId} value={a.apartmentId}>{a.city} · {a.address}</option>)}
      </SelectField>}
      <HebrewDateField name="start" minDate={today} label={t('exchange.from')} value={start} onChange={value => change('start', value)} />
      <HebrewDateField name="end" minDate={start || today} label={t('exchange.to')} value={end} onChange={value => change('end', value)} />
      <p className="text-sm text-muted sm:col-span-2">{t('discovery.dateHint')}</p>
    </form>
    {!authenticated ? <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <p>{t('discovery.authHint')}</p>
      <div className="flex flex-wrap gap-3"><Link className="text-primary underline" to="/register" state={{ from: location }}>{t('discovery.register')}</Link><Link className="text-primary underline" to="/login" state={{ from: location }}>{t('home.signIn')}</Link></div>
    </div> : <>
      {listings.isError && <EmptyState title={t('apartments.loadError')} action={<Button onClick={() => listings.refetch()}>{t('common.retry')}</Button>} />}
      {preview && <div className="rounded-xl border border-border p-4"><p>{t('discovery.previewHint')}</p><Link className="text-primary underline" to={`/my-apartments?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>{t('exchange.publish')}</Link></div>}
      {offer && <p className="text-sm text-muted">{t('exchange.offerPeriod', { from: formatExchangeDate(offer.availableFrom, i18n.language), to: formatExchangeDate(offer.availableTo, i18n.language) })}</p>}
      <div aria-live="polite">
        {!ready ? <p>{start && end && !datesValid ? t('exchange.datesInvalid') : !preview && datesValid && !offerCovers ? t('exchange.offerUnavailable') : t('discovery.ready')}</p> : signature !== debouncedSignature || matches.isPending ? <p role="status">{t('exchange.matching')}</p> : matches.isError ? <EmptyState title={t('exchange.loadError')} action={<Button onClick={() => matches.refetch()}>{t('common.retry')}</Button>} /> : <>
          <h2 className="mb-4 text-lg font-semibold">{t('exchange.results', { count: matches.data?.length ?? 0 })}</h2>
          {matches.data?.length === 0 ? <EmptyState title={t('exchange.none')} description={t('discovery.emptyHint')} action={<a className="text-primary underline" href="#exchange-search">{t('discovery.changeSearch')}</a>} /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{matches.data?.map(match => <div className="flex flex-col gap-2" key={match.apartment.apartmentId}><p className={match.isMutual && !preview ? 'font-medium text-primary' : 'text-sm text-muted'}>{t(preview ? 'discovery.previewLabel' : match.isMutual ? 'exchange.mutual' : 'exchange.possible')}</p><p className="text-sm text-muted">{t(preview ? 'discovery.previewHint' : match.isMutual ? 'discovery.mutualHint' : 'discovery.partialHint')}</p><ApartmentCard apartment={match.apartment} /></div>)}</div>}
        </>}
      </div>
    </>}
    <p className="text-sm text-muted">{t('exchange.disclaimer')}</p>
  </div>
}
