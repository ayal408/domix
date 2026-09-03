import { Suspense, useEffect, useRef } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppShell } from '@/components/layout/AppShell'
import { AdminLayout } from '@/features/admin/AdminLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { onSessionExpired } from '@/lib/sessionEvents'
import { lazyWithReload } from '@/lib/lazyWithReload'
import { Spinner } from '@/components/ui/Spinner'
import './i18n'

const HomePage = lazyWithReload(() => import('@/pages/HomePage'))
const ApartmentsCatalogPage = lazyWithReload(() => import('@/features/apartments/ApartmentsCatalogPage'))
const ApartmentDetailPage = lazyWithReload(() => import('@/features/apartments/ApartmentDetailPage'))
const MapPage = lazyWithReload(() => import('@/features/map/MapPage'))
const AccountPage = lazyWithReload(() => import('@/features/account/AccountPage'))
const MessagesPage = lazyWithReload(() => import('@/features/messages/MessagesPage'))
const MyApartmentsPage = lazyWithReload(() => import('@/features/apartments/MyApartmentsPage'))
const MortgageCalculatorPage = lazyWithReload(() => import('@/features/mortgage/MortgageCalculatorPage'))
const AdminApartmentsPage = lazyWithReload(() => import('@/features/admin/AdminApartmentsPage'))
const AdminSupportPage = lazyWithReload(() => import('@/features/admin/AdminSupportPage'))
const AdminUsersPage = lazyWithReload(() => import('@/features/admin/AdminUsersPage'))
const AdminAnalyticsPage = lazyWithReload(() => import('@/features/admin/AdminAnalyticsPage'))
const AdminNotificationsPage = lazyWithReload(() => import('@/features/admin/AdminNotificationsPage'))
const FavoritesPage = lazyWithReload(() => import('@/features/apartments/FavoritesPage'))
const ComparePage = lazyWithReload(() => import('@/features/apartments/ComparePage'))
const SavedSearchesPage = lazyWithReload(() => import('@/features/account/SavedSearchesPage'))
const LoginPage = lazyWithReload(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazyWithReload(() => import('@/features/auth/RegisterPage'))
const VerifyEmailPage = lazyWithReload(() => import('@/pages/VerifyEmailPage'))
const ForgotPasswordPage = lazyWithReload(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazyWithReload(() => import('@/features/auth/ResetPasswordPage'))
const UnauthorizedPage = lazyWithReload(() => import('@/pages/UnauthorizedPage'))
const NotFoundPage = lazyWithReload(() => import('@/pages/NotFoundPage'))

function PageFallback() {
  return (
    <div className="flex justify-center py-24">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  )
}

/**
 * `ApartmentsCatalogPage` calls endpoints that require authentication, so an
 * anonymous visitor hitting `/` would only see 401s. Route them to the public
 * landing page instead; renders nothing while the session is still being
 * restored, matching `ProtectedRoute`'s no-flash behavior.
 */
function IndexRoute() {
  const status = useAuthStore((state) => state.status)
  if (status === 'initializing') return null
  return status === 'authenticated' ? <ApartmentsCatalogPage /> : <HomePage />
}

export default function App() {
  const { t } = useTranslation()
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const pushToast = useToastStore((state) => state.push)
  const navigate = useNavigate()
  const location = useLocation()

  // Kept current on every render so the session-expiry subscription below
  // (registered once) always redirects from wherever the user actually is,
  // not from wherever they were when the listener was first attached.
  const locationRef = useRef(location)
  useEffect(() => {
    locationRef.current = location
  }, [location])

  // Restores the session from the httpOnly refresh cookie exactly once.
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // A 401 that a refresh couldn't recover from (see auth.store.ts's
  // `setSessionExpiredHandler` wiring) sends the user to /login exactly once —
  // never for the silent anonymous bootstrap probe, and never twice for one
  // expiry, since the store already no-ops once `status` is `unauthenticated`.
  useEffect(() => {
    return onSessionExpired(() => {
      pushToast({ variant: 'error', title: t('errors.unauthorized') })
      const current = locationRef.current
      if (current.pathname !== '/login') {
        navigate('/login', { replace: true, state: { from: current } })
      }
    })
  }, [navigate, pushToast, t])

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<IndexRoute />} />
          <Route path="apartments/:apartmentId" element={<ApartmentDetailPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="mortgage-calculator" element={<MortgageCalculatorPage />} />
          <Route
            path="account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="messages"
            element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="my-apartments"
            element={
              <ProtectedRoute>
                <MyApartmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="favorites"
            element={
              <ProtectedRoute>
                <FavoritesPage />
              </ProtectedRoute>
            }
          />
          <Route path="compare" element={<ComparePage />} />
          <Route
            path="saved-searches"
            element={
              <ProtectedRoute>
                <SavedSearchesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin"
            element={
              <ProtectedRoute policy="ManagerOrAdmin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="apartments" element={<AdminApartmentsPage />} />
            <Route path="support" element={<AdminSupportPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
          </Route>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
