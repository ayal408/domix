import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/EmptyState'

export default function UnauthorizedPage() {
  const { t } = useTranslation()
  return (
    <div className="py-12">
      <EmptyState
        title={t('pages.unauthorized.title')}
        description={t('pages.unauthorized.description')}
        action={
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            {t('pages.unauthorized.backHome')}
          </Link>
        }
      />
    </div>
  )
}
