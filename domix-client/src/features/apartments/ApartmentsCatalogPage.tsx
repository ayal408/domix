import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useApartments, useApartmentSearch } from '@/hooks/useApartments'
import { ApartmentSearchForm } from '@/features/apartments/ApartmentSearchForm'
import { ApartmentCard } from '@/features/apartments/ApartmentCard'
import { SaveSearchButton } from '@/features/apartments/SaveSearchButton'
import { ApartmentCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { APARTMENT_SEARCH_DEFAULTS, type ApartmentSearchFormValues } from '@/features/apartments/schemas'
import type { ApartmentSearchQuery, PropertyType } from '@/types/api'
import { PROPERTY_TYPES } from '@/types/api'

function toSearchQuery(values: ApartmentSearchFormValues): ApartmentSearchQuery {
  return {
    city: values.city?.trim() || undefined,
    area: values.area?.trim() || undefined,
    minPrice: values.minPrice,
    maxPrice: values.maxPrice,
    minRooms: values.minRooms,
    maxRooms: values.maxRooms,
    propertyType: values.propertyType,
    parking: values.parking || undefined,
    elevator: values.elevator || undefined,
    sortBy: values.sortBy,
  }
}

function isEmptyQuery(query: ApartmentSearchQuery): boolean {
  return (
    !query.city &&
    !query.area &&
    query.minPrice == null &&
    query.maxPrice == null &&
    query.minRooms == null &&
    query.maxRooms == null &&
    !query.propertyType &&
    !query.parking &&
    !query.elevator &&
    !query.sortBy
  )
}

/** Reads the filter params a "run this saved search" link puts on `/` (see `SavedSearchesPage`). */
function fromSearchParams(searchParams: URLSearchParams): { query: ApartmentSearchQuery | null; formValues: ApartmentSearchFormValues } {
  const propertyType = searchParams.get('propertyType')
  const query: ApartmentSearchQuery = {
    city: searchParams.get('city') || undefined,
    area: searchParams.get('area') || undefined,
    minPrice: searchParams.has('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.has('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    minRooms: searchParams.has('minRooms') ? Number(searchParams.get('minRooms')) : undefined,
    maxRooms: searchParams.has('maxRooms') ? Number(searchParams.get('maxRooms')) : undefined,
    propertyType: (PROPERTY_TYPES as readonly string[]).includes(propertyType ?? '') ? (propertyType as PropertyType) : undefined,
    parking: searchParams.get('parking') === 'true' || undefined,
    elevator: searchParams.get('elevator') === 'true' || undefined,
  }

  return {
    query: isEmptyQuery(query) ? null : query,
    formValues: {
      ...APARTMENT_SEARCH_DEFAULTS,
      city: query.city ?? '',
      area: query.area ?? '',
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      minRooms: query.minRooms,
      maxRooms: query.maxRooms,
      propertyType: query.propertyType as ApartmentSearchFormValues['propertyType'],
      parking: query.parking ?? false,
      elevator: query.elevator ?? false,
    },
  }
}

export default function ApartmentsCatalogPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const initial = useMemo(() => fromSearchParams(searchParams), [searchParams])
  const [activeQuery, setActiveQuery] = useState<ApartmentSearchQuery | null>(initial.query)
  const ownerId = searchParams.get('owner')

  const allApartments = useApartments()
  const searchResults = useApartmentSearch(activeQuery ?? {}, activeQuery != null)

  const isSearching = activeQuery != null
  const { data, isLoading, isError, refetch } = isSearching ? searchResults : allApartments

  const listings = useMemo(() => {
    // `useApartments()` is the unfiltered dataset shared with the admin/my-apartments tables, so
    // Rented/Sold listings must be dropped here for the public browse view. Server-side search
    // (`isSearching`) already excludes them.
    const base = (data ?? []).filter((apartment) => isSearching || apartment.status === 'Available')
    return ownerId ? base.filter((apartment) => apartment.userId === ownerId) : base
  }, [data, ownerId, isSearching])

  function handleSearchSubmit(values: ApartmentSearchFormValues) {
    const query = toSearchQuery(values)
    setActiveQuery(isEmptyQuery(query) ? null : query)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('apartments.catalogTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{t('apartments.catalogSubtitle')}</p>
      </div>

      <ApartmentSearchForm
        onSubmit={handleSearchSubmit}
        onClear={() => setActiveQuery(null)}
        initialValues={initial.formValues}
      />

      {isSearching && (
        <div className="flex justify-end">
          <SaveSearchButton query={activeQuery} />
        </div>
      )}

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <ApartmentCardSkeleton key={index} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState title={t('apartments.empty.title')} description={t('apartments.empty.description')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((apartment) => (
            <ApartmentCard key={apartment.apartmentId} apartment={apartment} />
          ))}
        </div>
      )}
    </div>
  )
}
