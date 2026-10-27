import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher'
import { MessageIndicator } from './MessageIndicator'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { env } from '@/config/env'
import { base64ToImageSrc, initialsOf } from '@/lib/sanitize'
import './navigation.i18n'

const navLinkClasses = ({ isActive }: { isActive: boolean }) => cn(
  'flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-card-muted',
)
const menuClasses = 'z-[60] mt-2 max-h-[min(70vh,32rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-xl focus:outline-none'
type NavItem = { to: string; label: string }
function NavMenu({ label, items, icon, className }: { label: string; items: NavItem[]; icon?: boolean; className?: string }) {
  return <Menu as="div" className={cn('relative', className)}>
    <MenuButton aria-label={label} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {icon ? <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> : <>{label}<span aria-hidden="true">⌄</span></>}
    </MenuButton>
    <MenuItems anchor="bottom end" className={menuClasses}>
      {items.map(item => <MenuItem key={item.to}><NavLink to={item.to} end={item.to === '/'} className={navLinkClasses}>{item.label}</NavLink></MenuItem>)}
    </MenuItems>
  </Menu>
}

export function Header() {
  const { t } = useTranslation()
  const { t: navigation } = useTranslation('navigation')
  const navigate = useNavigate()
  const status = useAuthStore(state => state.status)
  const user = useAuthStore(state => state.user)
  const can = useAuthStore(state => state.can)
  const signOut = useAuthStore(state => state.signOut)
  const primary: NavItem[] = [
    { to: '/', label: t('nav.home') }, { to: '/exchange', label: t('exchange.nav') },
    { to: '/my-apartments', label: t('nav.myApartments') }, { to: '/messages', label: t('nav.messages') },
  ]
  if (can('ManagerOrAdmin')) primary.push({ to: '/admin/apartments', label: t('nav.admin') })
  const secondary: NavItem[] = [
    { to: '/favorites', label: t('nav.favorites') }, { to: '/saved-searches', label: t('nav.savedSearches') },
    { to: '/map', label: t('nav.map') }, { to: '/compare', label: t('nav.compare') },
    { to: '/mortgage-calculator', label: t('nav.mortgageCalculator') }, { to: '/account', label: t('nav.myAccount') },
  ]
  const avatar = base64ToImageSrc(user?.profileImageBase64)
  return <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
    <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6">
      <NavLink to="/" className="shrink-0 bg-brand bg-clip-text text-xl font-extrabold tracking-tight text-transparent">{env.appName}</NavLink>
      <div className="flex max-w-full flex-wrap items-center gap-1">
        <LanguageSwitcher /><ThemeSwitcher />
        {status === 'authenticated' && user ? <>
          <MessageIndicator /><NotificationBell />
          <Menu as="div" className="relative">
            <MenuButton aria-label={navigation('account')} className="flex h-10 items-center gap-2 rounded-lg px-2 hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card-muted text-xs font-semibold text-muted">
                {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initialsOf(user.userName)}
              </span>
              <span className="hidden max-w-36 truncate text-sm text-muted xl:inline">{user.userName}</span>
            </MenuButton>
            <MenuItems anchor="bottom end" className={menuClasses}>
              <MenuItem><NavLink to="/account" className={navLinkClasses}>{t('nav.myAccount')}</NavLink></MenuItem>
              <MenuItem><button type="button" className="mt-1 flex min-h-10 w-full items-center rounded-lg px-3 text-start text-sm text-danger hover:bg-card-muted" onClick={async () => { await signOut(); navigate('/') }}>{t('nav.logout')}</button></MenuItem>
            </MenuItems>
          </Menu>
          <NavMenu label={navigation('menu')} items={[...primary, ...secondary]} icon className="lg:hidden" />
        </> : status === 'unauthenticated' ? <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>{t('nav.login')}</Button>
          <Button size="sm" onClick={() => navigate('/register')}>{t('nav.register')}</Button>
        </div> : null}
      </div>
    </div>
    {status === 'authenticated' && <nav aria-label={navigation('primary')} className="mx-auto hidden max-w-6xl flex-wrap items-center gap-1 border-t border-border px-6 py-1.5 lg:flex">
      {primary.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClasses}>{item.label}</NavLink>)}
      <NavMenu label={navigation('more')} items={secondary} />
    </nav>}
  </header>
}
