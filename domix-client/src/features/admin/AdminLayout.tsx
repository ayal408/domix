import { useEffect, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import { MarketIcon } from '@/components/ui/MarketIcon'
import { AdminNavigation } from './AdminNavigation'
import { activeAdminItem } from './adminNavigationConfig'
import './email.i18n'
import './admin-shell.i18n'

/** Existing server/route policies still enforce access; the shell also follows live role changes. */
export function AdminLayout() {
  const {t}=useTranslation('adminShell')
  const role=useAuthStore(s=>s.user?.role)
  const {pathname}=useLocation()
  const [collapsed,setCollapsed]=useState(false)
  const [mobileOpen,setMobileOpen]=useState(false)
  const active=activeAdminItem(pathname,role)
  useEffect(()=>{
    if(typeof window.matchMedia !== 'function')return
    const media=window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop=()=>{if(media.matches)setMobileOpen(false)}
    media.addEventListener('change',closeOnDesktop)
    return ()=>media.removeEventListener('change',closeOnDesktop)
  },[])
  if(role!=='Admin'&&role!=='Manager')return <Navigate to="/unauthorized" replace/>
  return <div className="admin-workspace" data-collapsed={collapsed}>
    <aside className="admin-side-panel">
      <div className="flex min-h-16 items-center justify-center gap-2 border-b border-border px-3"><img src={`${import.meta.env.BASE_URL}domix-mark.svg?v=purple-4`} alt="" className="h-8 w-8"/>{!collapsed&&<span className="text-sm font-bold">{t('workspace')}</span>}</div>
      <AdminNavigation mini={collapsed} idPrefix="admin-desktop"/>
      <button type="button" aria-label={t(collapsed?'expand':'collapse')} aria-expanded={!collapsed} onClick={()=>setCollapsed(value=>!value)} className="flex min-h-12 items-center justify-center gap-2 border-t border-border px-3 text-xs text-muted"><MarketIcon name="arrow" className={`h-4 w-4 ${collapsed?'rtl:rotate-180':'ltr:rotate-180'}`}/>{!collapsed&&t('collapse')}</button>
    </aside>
    <div className="min-w-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={()=>setMobileOpen(true)} aria-label={t('openMenu')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border lg:hidden"><MarketIcon name="list"/></button>
          <div><p className="text-xs text-muted">{t('workspace')} · {t(role==='Admin'?'admin':'manager')}</p><p className="mt-1 text-base font-bold">{t(active?.key??'dashboard')}</p></div>
        </div>
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-primary hover:bg-card-muted"><MarketIcon name="home"/>{t('back')}</Link>
      </div>
      <Outlet/>
    </div>
    <Dialog open={mobileOpen} onClose={()=>setMobileOpen(false)} className="relative z-[70]">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true"/>
      <div className="fixed inset-0"><DialogPanel className="absolute inset-y-0 start-0 flex w-72 max-w-[88vw] flex-col border-e border-border bg-card shadow-xl">
        <div className="flex min-h-16 items-center justify-between border-b border-border px-4"><DialogTitle className="text-base font-bold">{t('workspace')}</DialogTitle><button type="button" onClick={()=>setMobileOpen(false)} aria-label={t('closeMenu')} className="h-11 w-11 rounded-lg text-lg text-muted">×</button></div>
        <AdminNavigation idPrefix="admin-mobile" onNavigate={()=>setMobileOpen(false)}/>
      </DialogPanel></div>
    </Dialog>
  </div>
}
