import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/EmptyState'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="py-12">
      <EmptyState
        title={t('pages.notFound.title')}
        description={t('pages.notFound.description')}
        action={
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            {t('pages.notFound.backHome')}
          </Link>
        }
      />
    </div>
  )
}
