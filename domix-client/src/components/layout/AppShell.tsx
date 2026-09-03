import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { EmailVerificationBanner } from '@/components/layout/EmailVerificationBanner'
import { PresenceConnector } from '@/components/layout/PresenceConnector'
import { ThemeSync } from '@/components/layout/ThemeSync'
import { Toaster } from '@/components/ui/Toaster'
import { FloatingChatWidget } from '@/components/chat/FloatingChatWidget'

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PresenceConnector />
      <ThemeSync />
      <Header />
      <EmailVerificationBanner />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <Toaster />
      <FloatingChatWidget />
    </div>
  )
}
