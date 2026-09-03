import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

const tabClasses = ({ isActive }: { isActive: boolean }) =>
  cn(
    'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground',
  )

/** Shared shell for every `/admin/*` page — the route tree gates all of them on the ManagerOrAdmin policy. */
export function AdminLayout() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex gap-1 overflow-x-auto border-b border-border">
        <NavLink to="/admin/apartments" className={tabClasses}>
          {t('admin.nav.apartments')}
        </NavLink>
        <NavLink to="/admin/support" className={tabClasses}>
          {t('admin.nav.support')}
        </NavLink>
        <NavLink to="/admin/users" className={tabClasses}>
          {t('admin.nav.users')}
        </NavLink>
        <NavLink to="/admin/analytics" className={tabClasses}>
          {t('admin.nav.analytics')}
        </NavLink>
        <NavLink to="/admin/notifications" className={tabClasses}>
          {t('admin.nav.notifications')}
        </NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
