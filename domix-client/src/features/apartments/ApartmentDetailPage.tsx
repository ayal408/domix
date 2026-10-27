import { ShareListing } from './ShareListing'
import { ReportDialog } from '@/features/community/ReportDialog'
import { formatExchangeDate } from './exchangeDates'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApartmentDetail, useRateApartment } from '@/hooks/useApartments'
import { useFavoriteIds, useToggleFavorite } from '@/hooks/useFavorites'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { ContactOwnerForm } from '@/features/messages/ContactOwnerForm'
import { OwnerProfileCard } from '@/features/apartments/OwnerProfileCard'
import { formatArea, formatCurrency, formatDate } from '@/lib/format'
import { safeUrl } from '@/lib/sanitize'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StarRating, StarRatingInput } from '@/components/ui/StarRating'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import type { Guid } from '@/types/api'

export default function ApartmentDetailPage() {
  const { t, i18n } = useTranslation()
  const [reporting, setReporting] = useState(false)
  const location = useLocation()
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo
  const back = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/'
  const params = new URLSearchParams(location.search)
  const { apartmentId } = useParams<{ apartmentId: Guid }>()
  const { data: apartment, isLoading, isError, error, refetch } = useApartmentDetail(apartmentId)
  const currentUser = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated')
  const rateMutation = useRateApartment()
  const pushToast = useToastStore((state) => state.push)
  const { ids: favoriteIds } = useFavoriteIds()
  const toggleFavorite = useToggleFavorite()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (isError && !(error && 'response' in error && (error.response as { status?: number })?.status === 404)) {
    return <EmptyState title={t('apartments.loadError')} action={<Button onClick={() => refetch()}>{t('common.retry')}</Button>} />
  }

  if (!apartment) {
    return (
      <EmptyState
        title={t('apartments.detail.notFoundTitle')}
        description={t('apartments.detail.notFoundDescription')}
        action={
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            {t('apartments.detail.back')}
          </Link>
        }
      />
    )
  }

  const images = (apartment.apartmentImages ?? []).map((img) => safeUrl(img.imageUrl)).filter((src): src is string => !!src)

  return (
    <div className="flex flex-col gap-6">
      <Link to={back} className="w-fit text-sm font-medium text-primary hover:underline">
        &larr; {t('apartments.detail.back')}
      </Link>

      {images.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((src, index) => (
            <button
              key={src + index}
              type="button"
              aria-label={t('exchange.openImage', { index: index + 1, count: images.length })}
              onClick={() => setLightboxIndex(index)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={src}
                alt=""
                className="h-64 w-full rounded-xl border border-border object-cover transition-opacity hover:opacity-90"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card-muted text-muted">
          <BuildingIcon />
        </div>
      )}

      {lightboxIndex != null && (
        <ImageLightbox images={images} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {apartment.listingType === 'Exchange' && apartment.price === 0 ? t('exchange.noPayment') : formatCurrency(apartment.price, i18n.language)}{apartment.listingType === 'Rent' ? ` ${t('exchange.perMonth')}` : ''}
            </h1>
            {isAuthenticated && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  toggleFavorite.mutate({
                    apartmentId: apartment.apartmentId,
                    isFavorited: favoriteIds.has(apartment.apartmentId),
                  })
                }
              >
                {favoriteIds.has(apartment.apartmentId) ? t('favorites.remove') : t('favorites.add')}
              </Button>
            )}
          </div>
          <p className="mt-1 text-lg text-foreground">
            {apartment.city} · {apartment.area}
          </p>
          <p className="text-sm text-muted">{apartment.address}</p>
          {apartment.ratingCount > 0 && (
            <div className="mt-2">
              <StarRating value={apartment.rating} count={apartment.ratingCount} />
              {apartment.ratingIsLegacy && <p className="mt-1 text-xs text-muted">{t('rating.legacy')}</p>}
              {!apartment.ratingIsLegacy && (apartment.legacyRatingCount ?? 0) > 0 && <p className="mt-1 text-xs text-muted">{t('rating.legacySummary', { score: apartment.legacyRating, count: apartment.legacyRatingCount })}</p>}
            </div>
          )}
        </div>
        {apartment.status !== 'Available' && (
          <Badge tone="neutral">{t(`admin.apartments.status.${apartment.status}`)}</Badge>
        )}
      </div>

      <Card className="flex flex-col gap-2 p-4">
        <strong>{t(`exchange.types.${apartment.listingType ?? 'Unspecified'}`)}</strong>
        {apartment.listingType === 'Exchange' && <>
          <p>{t('exchange.availability')}: {formatExchangeDate(apartment.availableFrom, i18n.language)} — {formatExchangeDate(apartment.availableTo, i18n.language)}</p>
          <p>{t('exchange.destination')}: {apartment.desiredCity}</p>
          <Link className="text-primary underline" to="/exchange">{t('exchange.find')}</Link>
        </>}
      </Card>
      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
        <Stat label={t('apartments.fields.sumOfRooms')} value={apartment.sumOfRooms ?? '—'} />
        <Stat label={t('apartments.fields.sumOfBeds')} value={apartment.sumOfBeds ?? '—'} />
        <Stat label={t('apartments.fields.squareMeters')} value={formatArea(apartment.squareMeters, i18n.language)} />
        <Stat label={t('apartments.fields.floor')} value={apartment.floor ?? '—'} />
        {apartment.propertyType && (
          <Stat label={t('apartments.fields.propertyType')} value={t(`apartments.propertyTypes.${apartment.propertyType}`)} />
        )}
        <Stat label={t('apartments.fields.elevator')} value={apartment.elevator == null ? t('exchange.unknown') : apartment.elevator ? t('common.yes') : t('common.no')} />
        <Stat label={t('apartments.fields.parking')} value={apartment.parking == null ? t('exchange.unknown') : apartment.parking ? t('common.yes') : t('common.no')} />
      </dl>

      {currentUser && currentUser.userId !== apartment.userId && <a href="#contact-owner" className="inline-flex w-fit items-center justify-center rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring">{t('privateMessages:contact')}</a>}
      {currentUser && <button type="button" className="w-fit text-sm text-muted underline" onClick={()=>setReporting(true)}>{t('workflows:report')}</button>}
      {reporting && <ReportDialog target={{apartmentId:apartment.apartmentId}} onClose={()=>setReporting(false)} />}
      <ShareListing apartment={apartment} />
      <OwnerProfileCard
        ownerId={apartment.userId}
        currentApartmentId={apartment.apartmentId}
        isAnonymous={apartment.isAnonymous}
        listingAddress={`${apartment.address}, ${apartment.city}`}
      />

      {apartment.description && (
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('apartments.fields.description')}</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-muted">{apartment.description}</p>
        </div>
      )}

      <p className="text-xs text-muted">{t('apartments.detail.posted', { date: formatDate(apartment.dateInsert, i18n.language) })}</p>

      {currentUser && currentUser.userId !== apartment.userId && (
        <>
          <Card className="flex flex-col gap-2 p-4">
            <h2 className="text-base font-semibold text-foreground">{t('rating.rateThis')}</h2>
            <StarRatingInput
              disabled={rateMutation.isPending}
              onRate={async (score) => {
                try {
                  await rateMutation.mutateAsync({ apartmentId: apartment.apartmentId, payload: { score } })
                  pushToast({ variant: 'success', title: t('rating.submitted') })
                } catch (error) {
                  const apiError = toApiError(error)
                  pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
                }
              }}
            />
          </Card>
          <ContactOwnerForm isAnonymous={apartment.isAnonymous} apartmentId={apartment.apartmentId} listingAddress={apartment.address} ownerId={apartment.userId} senderId={currentUser.userId}
            offeredApartmentId={apartment.listingType === 'Exchange' ? params.get('offeredApartmentId') ?? undefined : undefined}
            exchangeStart={params.get('start') ?? undefined} exchangeEnd={params.get('end') ?? undefined} />
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  )
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12" aria-hidden="true">
      <path
        d="M4 21V5a1 1 0 011-1h6a1 1 0 011 1v16M4 21h16M12 21v-6a1 1 0 011-1h4a1 1 0 011 1v6M8 7h.01M8 11h.01M8 15h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
