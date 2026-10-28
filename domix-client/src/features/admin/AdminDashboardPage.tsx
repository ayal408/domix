import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAnalyticsSummary } from '@/hooks/useAnalytics'
import { useAuthStore } from '@/stores/auth.store'
import { formatDateTime, formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { MarketIcon, type MarketIconName } from '@/components/ui/MarketIcon'
import { EmptyState } from '@/components/ui/EmptyState'
import './admin-shell.i18n'

export default function AdminDashboardPage() {
  const {t,i18n}=useTranslation('adminShell')
  const role=useAuthStore(s=>s.user?.role)
  const summary=useAnalyticsSummary()
  const data=summary.data
  const actions: {key:string;to:string;icon:MarketIconName}[]=[
    {key:'listings',to:'/admin/apartments',icon:'home'}, {key:'moderation',to:'/admin/reports',icon:'list'},
    {key:'support',to:'/admin/support',icon:'message'}, {key:'notifications',to:'/admin/notifications',icon:'bell'},
    ...(role==='Admin'?[{key:'users',to:'/admin/users',icon:'user' as const},{key:'email',to:'/admin/email',icon:'message' as const}]:[]),
  ]
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-extrabold">{t('dashboard')}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t('dashboardHint')}</p></div><Button size="sm" variant="secondary" loading={summary.isFetching} onClick={()=>void summary.refetch()}>{t('refresh')}</Button></div>
    {summary.isError?<EmptyState title={t('failed')} action={<Button onClick={()=>void summary.refetch()}>{t('refresh')}</Button>}/>:summary.isLoading||!data?<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0,1,2,3].map(id=><Skeleton key={id} className="h-32 w-full rounded-xl"/>)}</div>:<>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {label:'available',value:data.availableApartments,to:'/admin/apartments',icon:'home' as const},
          {label:'people',value:data.totalUsers,to:role==='Admin'?'/admin/users':'/admin/analytics',icon:'user' as const},
          {label:'openSupport',value:data.openSupportTickets,to:'/admin/support',icon:'message' as const},
          {label:'newListings',value:data.newApartmentsLast7Days,to:'/admin/analytics',icon:'plus' as const},
        ].map(tile=><Link key={tile.label} to={tile.to} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border border-t-4 border-t-primary bg-card p-4 shadow-card hover:shadow-card-hover"><div className="flex items-start justify-between gap-2"><span className="text-xs font-medium leading-relaxed text-muted">{t(tile.label)}</span><span className="rounded-lg bg-card-muted p-2 text-primary"><MarketIcon name={tile.icon}/></span></div><span className="text-3xl font-extrabold tabular-nums">{formatNumber(tile.value,i18n.language)}</span></Link>)}
      </div>
      <p className="text-xs text-muted">{t('updated',{time:formatDateTime(new Date(summary.dataUpdatedAt).toISOString(),i18n.language)})}</p>
    </>}
    <section><h2 className="mb-3 text-base font-bold">{t('quick')}</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{actions.map(action=><Link key={action.key} to={action.to} className="flex min-h-20 items-center gap-4 rounded-xl border border-border bg-card p-4 text-sm font-semibold hover:border-primary"><span className="rounded-xl bg-card-muted p-3 text-primary"><MarketIcon name={action.icon}/></span>{t(action.key)}</Link>)}</div></section>
  </div>
}
