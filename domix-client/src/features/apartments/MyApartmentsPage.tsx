import { RenewalReminders } from '@/features/community/RenewalReminders'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useApartments } from '@/hooks/useApartments'
import { useAuthStore } from '@/stores/auth.store'
import { ApartmentManagementList } from '@/features/apartments/ApartmentManagementList'

/** Every authenticated user's own listings — create/edit/delete/images, scoped to what they own. */
export default function MyApartmentsPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const handleCreateRequest = useCallback(() => {
    setParams(previous => { const next = new URLSearchParams(previous); next.delete('new'); return next }, { replace: true })
  }, [setParams])
  const returnTo = params.get('returnTo') ?? ''
  const canReturn = returnTo === '/exchange' || returnTo.startsWith('/exchange?')
  const userId = useAuthStore((state) => state.user?.userId)
  const { data: apartments, isLoading, isError, refetch } = useApartments()

  const own = useMemo(() => apartments?.filter((apartment) => apartment.userId === userId), [apartments, userId])

  if (isError) return <EmptyState title={t('apartments.loadError')} action={<Button onClick={() => refetch()}>{t('common.retry')}</Button>} />

  return (
    <div className="flex flex-col gap-4">
    {canReturn && <Link className="text-primary underline" to={returnTo}>{t('discovery.returnSearch')}</Link>}
    <Link className="w-fit text-primary underline" to="/my-leads">{t('returnTools:leads')}</Link>
    <RenewalReminders />
    <ApartmentManagementList
      createRequested={params.get('new') === '1'}
      onCreateRequestHandled={handleCreateRequest}
      apartments={own}
      isLoading={isLoading}
      title={t('myApartments.title')}
      subtitle={t('myApartments.subtitle')}
      newApartmentLabel={t('admin.apartments.newApartment')}
      emptyLabel={t('myApartments.empty')}
    />
    </div>
  )
}
