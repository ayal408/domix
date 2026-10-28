import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { formatCurrency, formatNumber } from '@/lib/format'
import { PROPERTY_TYPES } from '@/types/api'
import { numericCatalogParam, withoutCatalogFilter } from './catalogFilterParams'
import './catalog-tools.i18n'

export function ActiveCatalogFilters() {
  const {t, i18n} = useTranslation()
  const {t: text} = useTranslation('catalogTools')
  const [params, setParams] = useSearchParams()
  const chips: {key: string; label: string}[] = []
  const type = params.get('listingType')
  if (type && ['Sale','Rent','Exchange','Unspecified'].includes(type)) chips.push({key:'listingType',label:t(`exchange.types.${type}`)})
  for (const key of ['city','area'] as const) if (params.get(key)?.trim()) chips.push({key,label:`${t(`apartments.filters.${key}`)}: ${params.get(key)}`})
  for (const key of ['minPrice','maxPrice','minRooms','maxRooms'] as const) {
    const value = numericCatalogParam(params, key)
    if (value != null) chips.push({key,label:`${t(`apartments.filters.${key}`)}: ${key.endsWith('Price') ? formatCurrency(value,i18n.language) : formatNumber(value,i18n.language)}`})
  }
  const property = params.get('propertyType')
  if (property && (PROPERTY_TYPES as readonly string[]).includes(property)) chips.push({key:'propertyType',label:t(`apartments.propertyTypes.${property}`)})
  for (const key of ['parking','elevator'] as const) {
    const value = params.get(key)
    if (value === 'true' || value === 'false') chips.push({key,label:`${t(`apartments.filters.${key}`)}: ${t(value === 'true' ? 'common.yes' : 'common.no')}`})
  }
  if (params.get('owner')) chips.push({key:'owner',label:text('owner')})
  if (!chips.length) return null
  return <section aria-label={text('active')} className="flex min-w-0 flex-wrap gap-2">
    {chips.map(chip => <button key={chip.key} type="button" aria-label={text('removeFilter',{label:chip.label})}
      onClick={() => setParams(withoutCatalogFilter(params,chip.key))}
      className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-start text-xs font-medium text-primary hover:border-primary">
      <span className="min-w-0 break-words">{chip.label}</span><span aria-hidden="true" className="shrink-0">×</span>
    </button>)}
  </section>
}
