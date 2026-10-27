import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { Header } from '@/components/layout/Header'
import { EmailVerificationBanner } from '@/components/layout/EmailVerificationBanner'
import { PresenceConnector } from '@/components/layout/PresenceConnector'
import { ThemeSync } from '@/components/layout/ThemeSync'
import { Toaster } from '@/components/ui/Toaster'
import { FloatingChatWidget } from '@/components/chat/FloatingChatWidget'

export function AppShell() {
  const userId = useAuthStore(state => state.user?.userId)
  const { t } = useTranslation('privacy')
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PresenceConnector />
      <ThemeSync />
      <Header />
      <EmailVerificationBanner />
      <main className="mx-auto min-w-0 w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <Outlet />
      </main>
      <footer className="p-4 text-center text-sm"><Link to="/privacy" className="text-primary underline">{t('title')}</Link></footer>
      <Toaster />
      <FloatingChatWidget key={userId ?? 'guest'} />
    </div>
  )
}
