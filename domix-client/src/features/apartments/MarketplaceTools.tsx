import './catalog-tools.i18n'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MarketIcon, type MarketIconName } from '@/components/ui/MarketIcon'
import './marketplace.i18n'
export function MarketplaceTools() {
  const {t} = useTranslation('marketplace')
  const items: {title:string;hint:string;to:string;icon:MarketIconName}[] = [
    {title:'catalogTools:recent',hint:'catalogTools:recentLink',to:'/recently-viewed',icon:'home'},
    {title:'savedTitle',hint:'savedHint',to:'/favorites',icon:'heart'},
    {title:'alertsTitle',hint:'alertsHint',to:'/saved-searches',icon:'bell'},
    {title:'visitTitle',hint:'visitHint',to:'/visits',icon:'calendar'},
  ]
  return <aside className="hidden min-w-0 flex-col gap-4 lg:flex"><h2 className="market-kicker">{t('tools')}</h2>
    {items.map(item => <Link key={item.to} to={item.to} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary">
      <span className="mb-4 inline-flex rounded-xl bg-card-muted p-3 text-primary"><MarketIcon name={item.icon}/></span>
      <h3 className="text-sm font-bold">{t(item.title)}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{t(item.hint)}</p>
    </Link>)}
  </aside>
}
