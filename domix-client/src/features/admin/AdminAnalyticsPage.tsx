import { useTranslation } from 'react-i18next'
import { useAnalyticsSummary } from '@/hooks/useAnalytics'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'

type Tone = 'default' | 'success' | 'warning' | 'danger'

const VALUE_TONE: Record<Tone, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

function StatTile({ label, value, tone = 'default' }: { label: string; value: number; tone?: Tone }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums', VALUE_TONE[tone])}>{value.toLocaleString()}</p>
    </Card>
  )
}

/** Headline counts across users, listings, and support — Admin/Manager only. */
export default function AdminAnalyticsPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useAnalyticsSummary()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('admin.analytics.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('admin.analytics.subtitle')}</p>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">{t('admin.analytics.usersSection')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label={t('admin.analytics.totalUsers')} value={data.totalUsers} />
              <StatTile label={t('admin.analytics.verifiedUsers')} value={data.verifiedUsers} tone="success" />
              <StatTile label={t('admin.analytics.blockedUsers')} value={data.blockedUsers} tone="danger" />
              <StatTile label={t('admin.analytics.newUsers7d')} value={data.newUsersLast7Days} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">{t('admin.analytics.apartmentsSection')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatTile label={t('admin.analytics.totalApartments')} value={data.totalApartments} />
              <StatTile label={t('admin.apartments.status.Available')} value={data.availableApartments} tone="success" />
              <StatTile label={t('admin.apartments.status.Rented')} value={data.rentedApartments} />
              <StatTile label={t('admin.apartments.status.Sold')} value={data.soldApartments} />
              <StatTile label={t('admin.analytics.newApartments7d')} value={data.newApartmentsLast7Days} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">{t('admin.analytics.supportSection')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label={t('admin.analytics.openTickets')} value={data.openSupportTickets} tone="warning" />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
