import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { useCompareStore, MAX_COMPARE } from '@/stores/compare.store'
import { useFavoriteIds, useToggleFavorite } from '@/hooks/useFavorites'
import { useToastStore } from '@/stores/toast.store'
import type { Apartment } from '@/types/api'
import { formatCurrency } from '@/lib/format'
import { safeUrl } from '@/lib/sanitize'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { StarRating } from '@/components/ui/StarRating'

export function ApartmentCard({ apartment }: { apartment: Apartment }) {
  const { t, i18n } = useTranslation()
  const cover = safeUrl(apartment.apartmentImages?.[0]?.imageUrl)
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated')
  const { ids: favoriteIds } = useFavoriteIds()
  const toggleFavorite = useToggleFavorite()
  const isSelectedForCompare = useCompareStore((state) => state.isSelected(apartment.apartmentId))
  const toggleCompare = useCompareStore((state) => state.toggle)
  const compareCount = useCompareStore((state) => state.apartmentIds.length)
  const pushToast = useToastStore((state) => state.push)
  const isFavorited = favoriteIds.has(apartment.apartmentId)

  function handleToggleFavorite(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    toggleFavorite.mutate({ apartmentId: apartment.apartmentId, isFavorited })
  }

  function handleToggleCompare(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (!isSelectedForCompare && compareCount >= MAX_COMPARE) {
      pushToast({ variant: 'info', title: t('compare.limitReached', { count: MAX_COMPARE }) })
      return
    }
    toggleCompare(apartment.apartmentId)
  }

  return (
    <Link
      to={`/apartments/${apartment.apartmentId}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative h-44 w-full overflow-hidden bg-card-muted">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <BuildingIcon />
          </div>
        )}
        {!apartment.status && (
          <span className="absolute end-2 top-2">
            <Badge tone="neutral">{t('apartments.card.inactive')}</Badge>
          </span>
        )}
        {isAuthenticated && (
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-pressed={isFavorited}
            aria-label={t(isFavorited ? 'favorites.remove' : 'favorites.add')}
            className="absolute start-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <HeartIcon filled={isFavorited} />
          </button>
        )}
        <button
          type="button"
          onClick={handleToggleCompare}
          aria-pressed={isSelectedForCompare}
          className={cn(
            'absolute bottom-2 start-2 rounded-full px-2 py-1 text-xs font-medium text-white transition-colors',
            isSelectedForCompare ? 'bg-primary' : 'bg-black/40 hover:bg-black/60',
          )}
        >
          {isSelectedForCompare ? `✓ ${t('compare.short')}` : t('compare.short')}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-lg font-semibold text-foreground">
          {formatCurrency(apartment.price, i18n.language)}
        </p>
        <p className="truncate text-sm font-medium text-foreground">
          {apartment.city} · {apartment.area}
        </p>
        <p className="truncate text-xs text-muted">{apartment.address}</p>

        {apartment.ratingCount > 0 && (
          <StarRating value={apartment.rating} count={apartment.ratingCount} size="sm" />
        )}

        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs text-muted">
          {apartment.sumOfRooms != null && (
            <span>{t('apartments.card.roomsShort', { count: apartment.sumOfRooms })}</span>
          )}
          {apartment.squareMeters != null && (
            <span>{t('apartments.card.sqmShort', { count: apartment.squareMeters })}</span>
          )}
          {apartment.floor != null && <span>{t('apartments.card.floorShort', { floor: apartment.floor })}</span>}
        </div>
      </div>
    </Link>
  )
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
