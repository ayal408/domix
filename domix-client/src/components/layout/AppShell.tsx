import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Toaster } from '@/components/ui/Toaster'

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}
