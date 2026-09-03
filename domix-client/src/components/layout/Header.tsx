import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { env } from '@/config/env'
import { base64ToImageSrc, initialsOf } from '@/lib/sanitize'

const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded px-3 py-1.5 text-sm font-medium transition-colors duration-200',
    isActive ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-card-muted',
  )

export function Header() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const can = useAuthStore((state) => state.can)
  const signOut = useAuthStore((state) => state.signOut)

  const isAdmin = can('ManagerOrAdmin')

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <NavLink
            to="/"
            className="bg-brand bg-clip-text text-lg font-extrabold tracking-tight text-transparent"
          >
            {env.appName}
          </NavLink>
          {status === 'authenticated' && (
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink to="/" end className={navLinkClasses}>
                {t('nav.home')}
              </NavLink>
              <NavLink to="/map" className={navLinkClasses}>
                {t('nav.map')}
              </NavLink>
              <NavLink to="/mortgage-calculator" className={navLinkClasses}>
                {t('nav.mortgageCalculator')}
              </NavLink>
              <NavLink to="/compare" className={navLinkClasses}>
                {t('nav.compare')}
              </NavLink>
              <NavLink to="/favorites" className={navLinkClasses}>
                {t('nav.favorites')}
              </NavLink>
              <NavLink to="/saved-searches" className={navLinkClasses}>
                {t('nav.savedSearches')}
              </NavLink>
              <NavLink to="/messages" className={navLinkClasses}>
                {t('nav.messages')}
              </NavLink>
              <NavLink to="/my-apartments" className={navLinkClasses}>
                {t('nav.myApartments')}
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin/apartments" className={navLinkClasses}>
                  {t('nav.admin')}
                </NavLink>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeSwitcher />

          {status === 'authenticated' && user ? (
            <div className="ms-1 flex items-center gap-2">
              <NotificationBell />
              <NavLink to="/account" className="flex items-center gap-2" aria-label={t('nav.myAccount')}>
                <UserAvatar user={user} />
                <span className="hidden max-w-[10rem] truncate text-sm text-muted hover:text-foreground sm:inline">
                  {user.userName}
                </span>
              </NavLink>
              <Button variant="secondary" size="sm" onClick={handleSignOut}>
                {t('nav.logout')}
              </Button>
            </div>
          ) : status === 'unauthenticated' ? (
            <div className="ms-1 flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                {t('nav.login')}
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
                {t('nav.register')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {status === 'authenticated' && (
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1.5 sm:hidden">
          <NavLink to="/" end className={navLinkClasses}>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/map" className={navLinkClasses}>
            {t('nav.map')}
          </NavLink>
          <NavLink to="/mortgage-calculator" className={navLinkClasses}>
            {t('nav.mortgageCalculator')}
          </NavLink>
          <NavLink to="/compare" className={navLinkClasses}>
            {t('nav.compare')}
          </NavLink>
          <NavLink to="/account" className={navLinkClasses}>
            {t('nav.myAccount')}
          </NavLink>
          <NavLink to="/favorites" className={navLinkClasses}>
            {t('nav.favorites')}
          </NavLink>
          <NavLink to="/saved-searches" className={navLinkClasses}>
            {t('nav.savedSearches')}
          </NavLink>
          <NavLink to="/messages" className={navLinkClasses}>
            {t('nav.messages')}
          </NavLink>
          <NavLink to="/my-apartments" className={navLinkClasses}>
            {t('nav.myApartments')}
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/apartments" className={navLinkClasses}>
              {t('nav.admin')}
            </NavLink>
          )}
        </nav>
      )}
    </header>
  )
}

function UserAvatar({ user }: { user: { userName: string; profileImageBase64?: string | null } }) {
  const avatar = base64ToImageSrc(user.profileImageBase64)
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card-muted text-[11px] font-semibold text-muted">
      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initialsOf(user.userName)}
    </span>
  )
}
