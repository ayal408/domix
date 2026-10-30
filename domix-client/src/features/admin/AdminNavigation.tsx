import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MarketIcon } from '@/components/ui/MarketIcon'
import { useAuthStore } from '@/stores/auth.store'
import { adminGroupsFor, activeAdminItem } from './adminNavigationConfig'
import './admin-shell.i18n'

export function AdminNavigation({mini=false,onNavigate,idPrefix}:{mini?:boolean;onNavigate?:()=>void;idPrefix:string}) {
  const {t,i18n}=useTranslation('adminShell')
  const role=useAuthStore(s=>s.user?.role)
  const {pathname}=useLocation()
  const [search,setSearch]=useState('')
  const [expanded,setExpanded]=useState<Record<string,boolean>>({})
  const query=mini?'':search.trim().toLocaleLowerCase(i18n.language)
  const active=activeAdminItem(pathname,role)
  const groups=adminGroupsFor(role).map(group=>({...group,items:group.items.filter(item=>!query||t(item.key).toLocaleLowerCase(i18n.language).includes(query)||t(group.key).toLocaleLowerCase(i18n.language).includes(query))})).filter(group=>group.items.length)
  return <nav aria-label={t('workspace')} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
    {!mini&&<label className="mb-2 block px-1 text-xs font-medium text-muted">{t('search')}<input type="search" value={search} onChange={event=>setSearch(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground" /></label>}
    {!groups.length&&<p role="status" className="p-3 text-sm text-muted">{t('noResults')}</p>}
    {groups.map(group=>{
      const open=mini||!!query||(expanded[group.key]??true)
      const region=`${idPrefix}-${group.key}`
      return <div key={group.key}>
        {group.key!=='overview'&&!mini&&<button type="button" aria-expanded={open} aria-controls={region} disabled={!!query} onClick={()=>setExpanded(state=>({...state,[group.key]:!open}))} className="flex min-h-10 w-full items-center justify-between gap-2 px-3 text-start text-xs font-bold text-muted"><span>{t(group.key)}</span><span aria-hidden="true">{open?'−':'+'}</span></button>}
        <div id={region} hidden={!open} className="space-y-1">{group.items.map(item=><NavLink key={item.to} to={item.to} end={item.to==='/admin'} onClick={onNavigate}
          aria-current={active?.to===item.to?'page':undefined} aria-label={mini?t(item.key):undefined} title={mini?t(item.key):undefined}
          className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${mini?'justify-center':''} ${active?.to===item.to?'border-s-2 border-primary bg-card-muted text-primary':'text-foreground hover:bg-card-muted'}`}>
          <MarketIcon name={item.icon} className="h-5 w-5 shrink-0"/>{!mini&&<span>{t(item.key)}</span>}
        </NavLink>)}</div>
      </div>
    })}
  </nav>
}
