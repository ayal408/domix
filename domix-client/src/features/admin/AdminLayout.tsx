import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/auth.store'
import './email.i18n'

const tabClasses = ({ isActive }: { isActive: boolean }) =>
  cn(
    'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-card-muted hover:text-foreground',
  )

/** Shared shell for every `/admin/*` page — the route tree gates all of them on the ManagerOrAdmin policy. */
export function AdminLayout() {
  const { t } = useTranslation()
  const can = useAuthStore((state) => state.can)

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-1 border-b border-border pb-3">
        <NavLink to="/admin/apartments" className={tabClasses}>
          {t('admin.nav.apartments')}
        </NavLink>
        <NavLink to="/admin/support" className={tabClasses}>
          {t('admin.nav.support')}
        </NavLink>
        {can('AdminOnly') && <NavLink to="/admin/users" className={tabClasses}>
          {t('admin.nav.users')}
        </NavLink>}
        <NavLink to="/admin/analytics" className={tabClasses}>
          {t('admin.nav.analytics')}
        </NavLink>
        <NavLink to="/admin/notifications" className={tabClasses}>
          {t('admin.nav.notifications')}
        </NavLink>
        {can('AdminOnly') && <NavLink to="/admin/email" className={tabClasses}>{t('email:nav')}</NavLink>}
      </nav>
      <Outlet />
    </div>
  )
}
