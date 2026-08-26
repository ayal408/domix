import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useApartments } from '@/hooks/useApartments'
import { useAuthStore } from '@/stores/auth.store'
import { ApartmentManagementList } from '@/features/apartments/ApartmentManagementList'

/** Every authenticated user's own listings — create/edit/delete/images, scoped to what they own. */
export default function MyApartmentsPage() {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.user?.userId)
  const { data: apartments, isLoading } = useApartments()

  const own = useMemo(() => apartments?.filter((apartment) => apartment.userId === userId), [apartments, userId])

  return (
    <ApartmentManagementList
      apartments={own}
      isLoading={isLoading}
      title={t('myApartments.title')}
      subtitle={t('myApartments.subtitle')}
      newApartmentLabel={t('admin.apartments.newApartment')}
      emptyLabel={t('myApartments.empty')}
    />
  )
}
