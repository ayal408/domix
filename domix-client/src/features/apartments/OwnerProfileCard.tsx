import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUserById } from '@/hooks/useUser'
import { useApartments } from '@/hooks/useApartments'
import { base64ToImageSrc, initialsOf } from '@/lib/sanitize'
import { formatDate } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Guid } from '@/types/api'

/** The listing owner's mini "broker" profile — shown on `ApartmentDetailPage`. */
export function OwnerProfileCard({ ownerId, currentApartmentId }: { ownerId: Guid; currentApartmentId: Guid }) {
  const { t, i18n } = useTranslation()
  const { data: owner, isLoading } = useUserById(ownerId)
  const { data: apartments } = useApartments()

  const otherActiveListings = (apartments ?? []).filter(
    (apartment) => apartment.userId === ownerId && apartment.status && apartment.apartmentId !== currentApartmentId,
  ).length

  if (isLoading) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </Card>
    )
  }

  if (!owner) return null

  const avatar = base64ToImageSrc(owner.profileImageBase64)

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold text-foreground">{t('apartments.detail.listedBy')}</h2>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card-muted text-sm font-semibold text-muted">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initialsOf(owner.userName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{owner.userName}</p>
          <p className="text-xs text-muted">{t('account.joined', { date: formatDate(owner.joiningDate, i18n.language) })}</p>
        </div>
      </div>

      {owner.phoneNumber && <p className="text-sm text-foreground">{owner.phoneNumber}</p>}

      {otherActiveListings > 0 && (
        <Link
          to={`/?owner=${owner.userId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('apartments.detail.otherListings', { count: otherActiveListings })}
        </Link>
      )}
    </Card>
  )
}
