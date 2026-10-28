import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { CompareButton } from './CompareButton'
import { ListingFreshness } from './ListingFreshness'
import { useFavoriteIds, useToggleFavorite } from '@/hooks/useFavorites'
import type { Apartment } from '@/types/api'
import { formatCurrency } from '@/lib/format'
import { safeUrl } from '@/lib/sanitize'
import { Badge } from '@/components/ui/Badge'
import { StarRating } from '@/components/ui/StarRating'

import { MarketIcon } from '@/components/ui/MarketIcon'
import './marketplace.i18n'

export function ApartmentCard({ apartment, layout = 'grid' }: { apartment: Apartment; layout?: 'list' | 'grid' }) {
  const { t, i18n } = useTranslation()
  const { t: market } = useTranslation('marketplace')
  const location = useLocation()
  const cover = safeUrl(apartment.apartmentImages?.[0]?.imageUrl)
  const isAuthenticated = useAuthStore(state => state.status === 'authenticated')
  const { ids: favoriteIds } = useFavoriteIds()
  const toggleFavorite = useToggleFavorite()
  const isFavorited = favoriteIds.has(apartment.apartmentId)
  const href = `/apartments/${apartment.apartmentId}${location.pathname === '/exchange' ? location.search : ''}`
  const returnState = { returnTo: location.pathname + location.search }
  return <article className="market-card" data-layout={layout}>
    <Link to={href} state={returnState} className="absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${apartment.city}, ${apartment.address}`} />
    <div className="market-card-photo">
      {cover ? <img src={cover} alt="" loading="lazy" /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-muted"><BuildingIcon /><span className="text-xs">{market('missingPhoto')}</span></div>}
      <div className="absolute end-3 top-3"><Badge tone="neutral">{t(`exchange.types.${apartment.listingType ?? 'Unspecified'}`)}</Badge></div>
      {isAuthenticated && <button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); toggleFavorite.mutate({ apartmentId: apartment.apartmentId, isFavorited }) }}
        disabled={toggleFavorite.isPending} aria-pressed={isFavorited} aria-label={t(isFavorited ? 'favorites.remove' : 'favorites.add')}
        className="absolute start-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-card text-primary shadow-sm focus-visible:ring-2 focus-visible:ring-ring"><HeartIcon filled={isFavorited} /></button>}
      {(apartment.apartmentImages?.length ?? 0) > 0 && <span className="absolute bottom-3 end-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">{market('photos', { count: apartment.apartmentImages!.length })}</span>}
    </div>
    <div className="market-card-body">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><p className="text-base font-bold text-foreground">{apartment.city} · {apartment.area}</p><p className="mt-1 text-sm text-muted">{apartment.address}</p></div>
        <p className="text-xl font-extrabold tracking-tight text-foreground">{apartment.listingType === 'Exchange' && apartment.price === 0 ? t('exchange.noPayment') : formatCurrency(apartment.price, i18n.language)}
          {apartment.listingType === 'Rent' && <span className="ms-1 text-xs font-normal text-muted">{t('exchange.perMonth')}</span>}</p>
      </div>
      <div className="market-card-stats">
        {apartment.sumOfRooms != null && <span>{t('apartments.card.roomsShort', { count: apartment.sumOfRooms })}</span>}
        {apartment.squareMeters != null && <span>{t('apartments.card.sqmShort', { count: apartment.squareMeters })}</span>}
        {apartment.floor != null && <span>{t('apartments.card.floorShort', { floor: apartment.floor })}</span>}
      </div>
      {apartment.status !== 'Available' && <div><Badge tone="neutral">{t(`admin.apartments.status.${apartment.status}`)}</Badge></div>}
      <ListingFreshness apartment={apartment} />
      {apartment.ratingCount > 0 && <div><StarRating value={apartment.rating} count={apartment.ratingCount} size="sm" />{apartment.ratingIsLegacy && <span className="text-xs text-muted">{t('rating.legacy')}</span>}</div>}
      <div className="market-card-actions">
        <span className="relative z-20"><CompareButton apartmentId={apartment.apartmentId} compact /></span>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">{market('view')}<MarketIcon name="arrow" className="h-4 w-4 rtl:rotate-180" /></span>
      </div>
    </div>
  </article>
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-9.8-9.1C.7 8.1 2.1 4.9 5.3 4.1c2-.5 4 .3 5.2 2 1.2-1.7 3.2-2.5 5.2-2 3.2.8 4.6 4 3.1 7.3-2.3 4.5-9.8 9.1-9.8 9.1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true">
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
