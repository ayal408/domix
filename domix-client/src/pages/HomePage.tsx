import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'

/**
 * Landing page for signed-out visitors. The real catalog (`ApartmentsCatalogPage`)
 * calls endpoints that require authentication, so showing it to an anonymous
 * visitor is a guaranteed 401 — this page replaces it at `/` until they sign in.
 */
export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{t('home.title')}</h1>
      <p className="text-base text-muted sm:text-lg">{t('home.description')}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={() => navigate('/register')}>
          {t('home.createAccount')}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => navigate('/login')}>
          {t('home.signIn')}
        </Button>
      </div>
    </div>
  )
}
