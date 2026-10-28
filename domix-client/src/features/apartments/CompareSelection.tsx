import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCompareStore, MAX_COMPARE } from '@/stores/compare.store'
import './comparison.i18n'

export function CompareSelection() {
  const { t } = useTranslation('comparison')
  const { t: common } = useTranslation()
  const count = useCompareStore(s => s.apartmentIds.length)
  const clear = useCompareStore(s => s.clear)
  const location = useLocation()
  if (!count || location.pathname === '/compare') return null
  return <aside aria-label={common('compare.title')} className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-card p-3">
    <span className="me-auto text-sm" role="status">{t('selection', { count, max: MAX_COMPARE })}</span>
    <Link className="inline-flex min-h-11 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground" to="/compare">{t('open')}</Link>
    <button className="min-h-11 px-2 text-sm text-muted underline" onClick={clear}>{common('compare.clearAll')}</button>
  </aside>
}
