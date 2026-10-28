import { ActiveCatalogFilters } from './ActiveCatalogFilters'
import { numericCatalogParam } from './catalogFilterParams'
import './catalog-tools.i18n'
import { MarketplaceTools } from './MarketplaceTools'
import { MarketIcon } from '@/components/ui/MarketIcon'
import './marketplace.i18n'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useApartmentPages } from '@/hooks/useApartments'
import { ApartmentSearchForm } from '@/features/apartments/ApartmentSearchForm'
import { ApartmentCard } from '@/features/apartments/ApartmentCard'
import { SaveSearchButton } from '@/features/apartments/SaveSearchButton'
import { ApartmentCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { APARTMENT_SEARCH_DEFAULTS, type ApartmentSearchFormValues } from '@/features/apartments/schemas'
import type { ApartmentSearchQuery, PropertyType } from '@/types/api'
import { PROPERTY_TYPES, SORT_OPTIONS } from '@/types/api'

function toSearchQuery(values: ApartmentSearchFormValues): ApartmentSearchQuery {
  return {
    city: values.city?.trim() || undefined,
    area: values.area?.trim() || undefined,
    minPrice: values.minPrice,
    maxPrice: values.maxPrice,
    minRooms: values.minRooms,
    maxRooms: values.maxRooms,
    propertyType: values.propertyType,
    parking: values.parking,
    elevator: values.elevator,
    sortBy: values.sortBy,
  }
}

function isEmptyQuery(query: ApartmentSearchQuery): boolean {
  return (
    !query.listingType &&
    !query.city &&
    !query.area &&
    query.minPrice == null &&
    query.maxPrice == null &&
    query.minRooms == null &&
    query.maxRooms == null &&
    !query.propertyType &&
    query.parking == null &&
    query.elevator == null &&
    !query.sortBy
  )
}

/** Reads the filter params a "run this saved search" link puts on `/` (see `SavedSearchesPage`). */
function fromSearchParams(searchParams: URLSearchParams): { query: ApartmentSearchQuery | null; formValues: ApartmentSearchFormValues } {
  const propertyType = searchParams.get('propertyType')
  const query: ApartmentSearchQuery = {
    listingType: searchParams.get('listingType') || undefined,
    sortBy: ['newest', 'price_asc', 'price_desc', 'rating'].includes(searchParams.get('sortBy') ?? '') ? searchParams.get('sortBy') as ApartmentSearchQuery['sortBy'] : undefined,
    city: searchParams.get('city') || undefined,
    area: searchParams.get('area') || undefined,
    minPrice: numericCatalogParam(searchParams, 'minPrice'),
    maxPrice: numericCatalogParam(searchParams, 'maxPrice'),
    minRooms: numericCatalogParam(searchParams, 'minRooms'),
    maxRooms: numericCatalogParam(searchParams, 'maxRooms'),
    propertyType: (PROPERTY_TYPES as readonly string[]).includes(propertyType ?? '') ? (propertyType as PropertyType) : undefined,
    parking: searchParams.get('parking') === 'true' ? true : searchParams.get('parking') === 'false' ? false : undefined,
    elevator: searchParams.get('elevator') === 'true' ? true : searchParams.get('elevator') === 'false' ? false : undefined,
  }

  return {
    query: isEmptyQuery(query) ? null : query,
    formValues: {
      ...APARTMENT_SEARCH_DEFAULTS,
      sortBy: query.sortBy,
      city: query.city ?? '',
      area: query.area ?? '',
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      minRooms: query.minRooms,
      maxRooms: query.maxRooms,
      propertyType: query.propertyType as ApartmentSearchFormValues['propertyType'],
      parking: query.parking,
      elevator: query.elevator,
    },
  }
}

export default function ApartmentsCatalogPage() {
  const { t } = useTranslation()
  const { t: market } = useTranslation('marketplace')
  const { t: tools } = useTranslation('catalogTools')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = useMemo(() => fromSearchParams(searchParams), [searchParams])
  const activeQuery = initial.query
  const ownerId = searchParams.get('owner')

  const results = useApartmentPages(activeQuery ?? {}, ownerId ?? undefined)
  const { data, isLoading, isError, refetch } = results
  const isSearching = activeQuery != null
  const listings = useMemo(() => data?.pages.flat() ?? [], [data])

  function handleSearchSubmit(values: ApartmentSearchFormValues) {
    setFiltersOpen(false)
    const query = { ...toSearchQuery(values), listingType: searchParams.get('listingType') || undefined }
    const next = new URLSearchParams()
    if (ownerId) next.set('owner', ownerId)
    if (searchParams.get('listingType')) next.set('listingType', searchParams.get('listingType')!)
    for (const [key, value] of Object.entries(query)) if (value != null) next.set(key, String(value))
    setSearchParams(next)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="market-kicker mb-2">DOMIX / {market('filters')}</p><h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{market('title')}</h1><p className="mt-2 text-sm text-muted">{market('searchHint')}</p></div>
      </div>
      <div className="market-tabs" role="group" aria-label={t('exchange.listingType')}>
        {['', 'Sale', 'Rent', 'Exchange', 'Unspecified'].map(type => <button key={type} type="button" aria-pressed={(searchParams.get('listingType') ?? '') === type}
          onClick={() => { const next = new URLSearchParams(searchParams); if (type) next.set('listingType',type); else next.delete('listingType'); setSearchParams(next) }}>{market(type || 'all')}</button>)}
      </div>
      <ActiveCatalogFilters />
      <button type="button" aria-expanded={filtersOpen} aria-controls="market-search-panel" onClick={() => setFiltersOpen(value => !value)} className="flex min-h-12 items-center justify-between rounded-xl border border-border bg-card px-4 text-start text-sm font-semibold lg:hidden"><span>{market('filters')}{activeQuery?.city ? ` · ${activeQuery.city}` : ''}</span><MarketIcon name="search" /></button>
      <div id="market-search-panel" className={filtersOpen ? '' : 'hidden lg:block'}>
      <ApartmentSearchForm
        key={searchParams.toString()}
        onSubmit={handleSearchSubmit}
        onClear={() => setSearchParams(ownerId ? { owner: ownerId } : {})}
        initialValues={initial.formValues}
      />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div><h2 className="text-lg font-bold">{market('results')}</h2>{!isLoading && !isError && <p role="status" className="mt-1 text-xs text-muted">{market('loaded', {count:listings.length})}</p>}</div>
        <div className="flex flex-wrap items-center gap-2">
          {isSearching && <SaveSearchButton query={activeQuery} />}
          <label className="flex min-h-10 items-center gap-2 text-xs font-medium text-muted">{tools('quickSort')}
            <select value={activeQuery?.sortBy ?? 'newest'} onChange={event => {
              const next = new URLSearchParams(searchParams)
              if (event.target.value === 'newest') next.delete('sortBy'); else next.set('sortBy',event.target.value)
              setSearchParams(next)
            }} className="min-h-10 max-w-40 rounded-lg border border-border bg-card px-2 text-sm text-foreground">
              {SORT_OPTIONS.map(option => <option key={option} value={option}>{t(`apartments.sort.${option}`)}</option>)}
            </select>
          </label>
          <div className="flex rounded-lg border border-border bg-card p-1" role="group" aria-label={market('display')}>
            {(['list','grid'] as const).map(mode => <button key={mode} type="button" aria-label={market(mode)} aria-pressed={layout === mode} onClick={() => setLayout(mode)} className={`flex min-h-10 min-w-10 items-center justify-center rounded-md ${layout === mode ? 'bg-card-muted text-primary' : 'text-muted'}`}><MarketIcon name={mode} /></button>)}
          </div>
        </div>
      </div>
      <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0">
      {isError ? (
        <EmptyState
          title={t('apartments.loadError')}
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : isLoading ? (
        <div className={layout === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2' : 'flex flex-col gap-4'}>
          {Array.from({ length: 8 }).map((_, index) => (
            <ApartmentCardSkeleton key={index} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState title={t('apartments.empty.title')} description={t('apartments.empty.description')} />
      ) : (
        <div className={layout === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2' : 'flex flex-col gap-4'}>
          {listings.map((apartment) => (
            <ApartmentCard key={apartment.apartmentId} apartment={apartment} layout={layout} />
          ))}
        </div>
      )}
      {results.hasNextPage && <div className="mt-5 flex justify-center"><Button
        loading={results.isFetchingNextPage} onClick={() => void results.fetchNextPage()}>{t('common.loadMore')}</Button></div>}
      </div>
      <MarketplaceTools />
      </div>
    </div>
  )
}
