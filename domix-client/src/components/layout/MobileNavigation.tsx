import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { dataClient } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { MarketIcon, type MarketIconName } from '@/components/ui/MarketIcon'
import '@/features/apartments/marketplace.i18n'

export function MobileNavigation() {
  const { t } = useTranslation('marketplace')
  const { t: nav } = useTranslation('navigation')
  const authenticated = useAuthStore(s => s.status === 'authenticated')
  const location = useLocation()
  const unread = useQuery({queryKey:[...queryKeys.messages.all, 'unread-count'], enabled:authenticated,
    queryFn: async ({signal}) => (await dataClient.get<{count:number}>('/Message/unread-count',{signal})).data,
    staleTime:15000,refetchInterval:30000})
  if (!authenticated || location.pathname === '/admin' || location.pathname.startsWith('/admin/')) return null
  const items: {to:string;label:string;icon:MarketIconName}[] = [
    {to:'/',label:t('search'),icon:'search'}, {to:'/favorites',label:t('favorites'),icon:'heart'},
    {to:'/my-apartments?new=1',label:t('publish'),icon:'plus'}, {to:'/messages',label:t('messages'),icon:'message'},
    {to:'/account',label:t('profile'),icon:'user'},
  ]
  return <nav aria-label={nav('primary')} className="market-mobile-nav">
    {items.map((item,index) => {
      const active = location.pathname === item.to.split('?')[0]
      const count = item.to === '/messages' ? unread.data?.count ?? 0 : 0
      return <Link key={item.to} to={item.to} aria-current={active?'page':undefined} className={index === 2 ? 'market-mobile-publish' : ''}>
        <span className="relative"><MarketIcon name={item.icon} />{count > 0 && <span aria-label={`${count}`} className="absolute -end-3 -top-2 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{count > 99 ? '99+' : count}</span>}</span>
        <span>{item.label}</span>
      </Link>
    })}
  </nav>
}
