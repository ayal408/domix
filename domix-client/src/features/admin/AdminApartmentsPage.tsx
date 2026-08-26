import { useTranslation } from 'react-i18next'
import { useApartments } from '@/hooks/useApartments'
import { ApartmentManagementList } from '@/features/apartments/ApartmentManagementList'

/** All listings, across every owner — Admin/Manager only (see `ProtectedRoute` in App.tsx). */
export default function AdminApartmentsPage() {
  const { t } = useTranslation()
  const { data: apartments, isLoading } = useApartments()

  return (
    <ApartmentManagementList
      apartments={apartments}
      isLoading={isLoading}
      title={t('admin.apartments.title')}
      subtitle={t('admin.apartments.subtitle')}
      newApartmentLabel={t('admin.apartments.newApartment')}
      emptyLabel={t('admin.apartments.empty')}
    />
  )
}
