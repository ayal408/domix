import { useTranslation } from 'react-i18next'
import { useFavorites } from '@/hooks/useFavorites'
import { ApartmentCard } from '@/features/apartments/ApartmentCard'
import { ApartmentCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export default function FavoritesPage() {
  const { t } = useTranslation()
  const { data: favorites, isLoading, isError, refetch } = useFavorites()

  const apartments = (favorites ?? [])
    .map((favorite) => favorite.apartment)
    .filter((apartment): apartment is NonNullable<typeof apartment> => !!apartment)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('favorites.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('favorites.subtitle')}</p>
      </div>

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
          {Array.from({ length: 4 }).map((_, index) => (
            <ApartmentCardSkeleton key={index} />
          ))}
        </div>
      ) : apartments.length === 0 ? (
        <EmptyState title={t('favorites.empty.title')} description={t('favorites.empty.description')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {apartments.map((apartment) => (
            <ApartmentCard key={apartment.apartmentId} apartment={apartment} />
          ))}
        </div>
      )}
    </div>
  )
}
