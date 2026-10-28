import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getApartment } from '@/api/apartments.api'
import { queryKeys } from '@/api/queryKeys'
import { toApiError } from '@/api/errors'
import { useAuthStore } from '@/stores/auth.store'
import { useRecentlyViewedStore } from '@/stores/recentlyViewed.store'
import { ApartmentCard } from './ApartmentCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import './catalog-tools.i18n'

const EMPTY_IDS: string[] = []
export default function RecentlyViewedPage() {
  const {t} = useTranslation('catalogTools')
  const {t: common} = useTranslation()
  const userId = useAuthStore(s => s.status === 'authenticated' ? s.user?.userId : undefined)
  const ids = useRecentlyViewedStore(s => userId && s.ownerId === userId ? s.apartmentIds : EMPTY_IDS)
  const clear = useRecentlyViewedStore(s => s.clear)
  const remove = useRecentlyViewedStore(s => s.remove)
  const queries = useQueries({queries: ids.map(id => ({
    queryKey: [...queryKeys.apartments.detail(id), 'recent', userId],
    queryFn: ({signal}: {signal: AbortSignal}) => getApartment(id, signal),
    staleTime: 0,
    retry: false,
  }))})
  return <div className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{t('recent')}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t('recentHint')}</p></div>
      {ids.length > 0 && <Button variant="secondary" onClick={clear}>{t('clearRecent')}</Button>}
    </div>
    {!ids.length ? <EmptyState title={t('emptyRecent')} description={t('emptyHint')} action={<Link className="text-primary underline" to="/">{t('returnSearch')}</Link>} /> :
      <ol className="flex min-w-0 flex-col gap-5">{ids.map((id,index) => {
        const query = queries[index]!
        return <li key={id} className="min-w-0">
          <div className="mb-2 flex justify-end"><button type="button" onClick={() => remove(id)} aria-label={`${t('removeRecent')} · ${index+1}`} className="min-h-10 rounded-lg px-3 text-xs text-muted underline">{t('removeRecent')}</button></div>
          {query.isPending ? <Skeleton className="h-56 w-full rounded-xl" /> : query.isError ? <div role="alert" className="rounded-xl border border-border bg-card p-5 text-sm">
            <p>{t(toApiError(query.error).status === 404 ? 'unavailable' : 'loadFailed')}</p>
            {toApiError(query.error).status !== 404 && <Button className="mt-3" size="sm" variant="secondary" onClick={() => void query.refetch()}>{common('common.retry')}</Button>}
          </div> : query.data && <ApartmentCard apartment={query.data} layout="list" />}
        </li>
      })}</ol>}
  </div>
}
