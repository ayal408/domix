import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getApartment } from '@/api/apartments.api'
import { queryKeys } from '@/api/queryKeys'
import { useCompareStore, MAX_COMPARE } from '@/stores/compare.store'
import { formatArea, formatCurrency, formatDate } from '@/lib/format'
import { safeUrl } from '@/lib/sanitize'
import { toApiError } from '@/api/errors'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { confirmationState } from './availabilityConfirmation'
import { formatExchangeDate } from './exchangeDates'
import type { Apartment } from '@/types/api'
import './comparison.i18n'

export default function ComparePage() {
  const { t, i18n } = useTranslation()
  const { t: text } = useTranslation('comparison')
  const apartmentIds = useCompareStore(s => s.apartmentIds)
  const remove = useCompareStore(s => s.remove)
  const clear = useCompareStore(s => s.clear)
  const [differencesOnly, setDifferencesOnly] = useState(false)
  // At most 3 detail requests; never fetch the whole catalog to compare a selection.
  const queries = useQueries({ queries: apartmentIds.map(id => ({
    queryKey: queryKeys.apartments.detail(id),
    queryFn: ({ signal }: { signal: AbortSignal }) => getApartment(id, signal),
    retry: false,
  })) })
  const apartments = queries.map(q => q.data)
  const lang = i18n.language
  const yesNo = (v: boolean | null | undefined) => v == null ? t('exchange.unknown') : t(v ? 'common.yes' : 'common.no')
  const rows: { id: string; label: string; value: (a: Apartment) => string | number }[] = [
    { id: 'type', label: t('exchange.listingType'), value: a => t(`exchange.types.${a.listingType ?? 'Unspecified'}`) },
    { id: 'status', label: t('admin.apartments.table.status'), value: a => t(`admin.apartments.status.${a.status}`) },
    { id: 'price', label: t('apartments.fields.price'), value: a => a.listingType === 'Exchange' && a.price === 0 ? t('exchange.noPayment') : `${formatCurrency(a.price, lang)}${a.listingType === 'Rent' ? ` ${t('exchange.perMonth')}` : ''}` },
    { id: 'city', label: t('apartments.filters.city'), value: a => `${a.city} · ${a.area}` },
    { id: 'rooms', label: t('apartments.fields.sumOfRooms'), value: a => a.sumOfRooms ?? '—' },
    { id: 'beds', label: t('apartments.fields.sumOfBeds'), value: a => a.sumOfBeds ?? '—' },
    { id: 'size', label: t('apartments.fields.squareMeters'), value: a => formatArea(a.squareMeters, lang) },
    { id: 'floor', label: t('apartments.fields.floor'), value: a => a.floor ?? '—' },
    { id: 'property', label: t('apartments.fields.propertyType'), value: a => a.propertyType ? t(`apartments.propertyTypes.${a.propertyType}`) : '—' },
    { id: 'elevator', label: t('apartments.fields.elevator'), value: a => yesNo(a.elevator) },
    { id: 'parking', label: t('apartments.fields.parking'), value: a => yesNo(a.parking) },
    { id: 'date', label: text('availability'), value: a => `${formatExchangeDate(a.availableFrom, lang)}${a.availableTo ? ` · ${text('through')} ${formatExchangeDate(a.availableTo, lang)}` : ''}` },
    { id: 'confirmation', label: text('freshness'), value: a => a.status === 'Available' || a.status === 'Negotiating' ? text(confirmationState(a.lastConfirmedAt), { date: formatDate(a.lastConfirmedAt, lang) }) : '—' },
    { id: 'rating', label: t('apartments.fields.rating'), value: a => a.ratingCount > 0 ? `${a.rating.toFixed(1)} (${a.ratingCount})` : '—' },
  ]
  const loaded = apartments.filter((a): a is Apartment => !!a)
  const visibleRows = rows.filter(row => !differencesOnly || loaded.length < 2 || new Set(loaded.map(row.value)).size > 1)
  return <div className="flex min-w-0 flex-col gap-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('compare.title')}</h1><p className="mt-1 text-sm text-muted">{text('hint')}</p></div>
      {apartmentIds.length > 0 && <Button variant="secondary" size="sm" onClick={clear}>{t('compare.clearAll')}</Button>}
    </div>
    {!apartmentIds.length ? <EmptyState title={t('compare.empty.title')} description={text('empty')}
      action={<Link to="/" className="text-primary underline">{t('apartments.detail.back')}</Link>} /> : <>
      <p className="text-sm text-muted">{text('selection', { count: apartmentIds.length, max: MAX_COMPARE })}</p>
      <label className="flex w-fit items-center gap-2 text-sm"><input type="checkbox" checked={differencesOnly} onChange={e => setDifferencesOnly(e.target.checked)} />{text('differences')}</label>
      <div role="region" aria-label={t('compare.title')} tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-border focus-visible:ring-2 focus-visible:ring-ring">
        <table className="w-full border-collapse text-start">
          <caption className="sr-only">{t('compare.title')}</caption>
          <thead><tr>
            <th scope="col" className="sticky start-0 z-10 min-w-28 bg-card p-3 text-start text-sm">{t('apartments.fields.description')}</th>
            {apartmentIds.map((id, index) => {
              const a = apartments[index], query = queries[index]!
              const cover = safeUrl(a?.apartmentImages?.[0]?.imageUrl)
              return <th scope="col" key={id} className="min-w-48 max-w-72 bg-card p-3 text-start align-top">
                <div className="flex items-start gap-2">
                  <span className="me-auto text-sm">{text('column', { index: index + 1 })}</span>
                  <button type="button" onClick={() => remove(id)} aria-label={`${t('compare.remove')} · ${text('column', { index: index + 1 })}`} className="min-h-11 min-w-11 rounded-lg text-muted hover:bg-card-muted">✕</button>
                </div>
                {query.isPending ? <Skeleton className="h-20 w-full" /> : query.isError ? <div className="text-sm font-normal" role="alert">
                  <p>{text(toApiError(query.error).status === 404 ? 'unavailable' : 'failed')}</p>
                  {toApiError(query.error).status !== 404 && <Button size="sm" variant="secondary" onClick={() => void query.refetch()}>{t('common.retry')}</Button>}
                </div> : a && <Link to={`/apartments/${id}`} className="block text-sm text-primary hover:underline">
                  {cover && <img src={cover} alt="" className="mb-2 h-28 w-full rounded-lg object-cover" />}
                  {a.city} · {a.area}
                </Link>}
              </th>
            })}
          </tr></thead>
          <tbody>{visibleRows.map(row => <tr key={row.id} className="border-t border-border">
            <th scope="row" className="sticky start-0 z-10 min-w-28 max-w-40 bg-card p-3 text-start text-sm font-medium text-muted">{row.label}</th>
            {apartmentIds.map((id, index) => <td key={id} className="max-w-72 break-words p-3 text-sm text-foreground">{apartments[index] ? row.value(apartments[index]!) : '—'}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {visibleRows.length === 0 && <p className="text-sm text-muted">{text('same')}</p>}
      <p className="text-xs text-muted">{text('note')}</p>
    </>}
  </div>
}
