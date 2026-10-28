import { MobileNavigation } from './MobileNavigation'
import '@/features/apartments/marketplace.i18n'
import { CompareSelection } from '@/features/apartments/CompareSelection'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { Header } from '@/components/layout/Header'
import { EmailVerificationBanner } from '@/components/layout/EmailVerificationBanner'
import { PresenceConnector } from '@/components/layout/PresenceConnector'
import { ThemeSync } from '@/components/layout/ThemeSync'
import { Toaster } from '@/components/ui/Toaster'
import { FloatingChatWidget } from '@/components/chat/FloatingChatWidget'

export function AppShell() {
  const {pathname} = useLocation()
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  const authenticated = useAuthStore(state => state.status === 'authenticated')
  const userId = useAuthStore(state => state.user?.userId)
  const { t } = useTranslation('privacy')
  return (
    <div className="market-shell flex min-h-svh flex-col bg-background" data-mobile-nav={authenticated && !inAdmin}>
      <PresenceConnector />
      <ThemeSync />
      <Header />
      <EmailVerificationBanner />
      <main className="mx-auto min-w-0 w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-8">
        {!inAdmin && <CompareSelection />}
        <Outlet />
      </main>
      <footer className="mt-8 border-t border-border p-6 text-center text-sm"><Link to="/privacy" className="text-primary underline">{t('title')}</Link></footer>
      <MobileNavigation />
      <Toaster />
      <FloatingChatWidget key={userId ?? 'guest'} />
    </div>
  )
}
