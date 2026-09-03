import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUserById } from '@/hooks/useUser'
import { useApartments } from '@/hooks/useApartments'
import { base64ToImageSrc, initialsOf } from '@/lib/sanitize'
import { formatDate, toWhatsAppLink } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Guid } from '@/types/api'

interface Props {
  ownerId: Guid
  currentApartmentId: Guid
  /** When true, the owner chose to hide their identity on this listing — name, avatar, and phone are replaced with a generic label. */
  isAnonymous?: boolean
  /** Used only to prefill the WhatsApp message — omit to fall back to a generic one. */
  listingAddress?: string
}

/** The listing owner's mini "broker" profile — shown on `ApartmentDetailPage`. */
export function OwnerProfileCard({ ownerId, currentApartmentId, isAnonymous, listingAddress }: Props) {
  const { t, i18n } = useTranslation()
  const { data: owner, isLoading } = useUserById(ownerId)
  const { data: apartments } = useApartments()

  const otherActiveListings = (apartments ?? []).filter(
    (apartment) =>
      apartment.userId === ownerId && apartment.status === 'Available' && apartment.apartmentId !== currentApartmentId,
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

  if (isAnonymous) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-foreground">{t('apartments.detail.listedBy')}</h2>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card-muted text-sm font-semibold text-muted">
            <UserIcon className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">{t('apartments.detail.privateOwner')}</p>
        </div>
      </Card>
    )
  }

  const avatar = base64ToImageSrc(owner.profileImageBase64)
  const whatsappLink = toWhatsAppLink(
    owner.phoneNumber,
    t('apartments.detail.whatsappMessage', { address: listingAddress ?? t('apartments.detail.thisListing') }),
  )

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

      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <WhatsAppIcon className="h-4 w-4" />
          {t('apartments.detail.whatsappButton')}
        </a>
      )}

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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.31 3.58-6 8-6s8 2.69 8 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.28 4.9L2 22l5.25-1.37a9.94 9.94 0 0 0 4.79 1.22h.01c5.52 0 10-4.48 10-10s-4.48-9.85-10.01-9.85Zm5.86 14.2c-.24.68-1.4 1.3-1.93 1.36-.5.06-1.06.28-3.56-.74-3-1.24-4.9-4.27-5.05-4.47-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.3.6-.37.8-.37.2 0 .4 0 .57.01.19.01.44-.07.68.52.25.6.85 2.08.92 2.23.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.3.15.47.12.65-.08.17-.2.73-.85.93-1.15.2-.3.4-.24.66-.15.27.1 1.7.8 1.99.95.3.15.49.22.56.34.07.13.07.72-.17 1.4Z" />
    </svg>
  )
}
