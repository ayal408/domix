import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { dataClient } from '@/api/http'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/Field'
import { useExchangeAction, exchangeError } from './useExchangeWorkflow'
import { formatExchangeDate } from './exchangeDates'

export default function ExchangeWatchesPage() {
  const { t, i18n } = useTranslation()
  const userId = useAuthStore(s => s.user?.userId)
  const action = useExchangeAction()
  const [error, setError] = useState('')
  const watches = useQuery({ queryKey: ['exchange', 'watches', userId], enabled: !!userId, queryFn: async ({ signal }) => (await dataClient.get<{ id: string; destination: string; start: string; end: string; frequency: string }[]>('/exchange/watches', { signal })).data })
  const blocks = useQuery({ queryKey: ['exchange', 'blocks', userId], enabled: !!userId, queryFn: async ({ signal }) => (await dataClient.get<{ id: string; blockedUserId: string; displayName?: string }[]>('/exchange/blocks', { signal })).data })
  async function perform(url: string, method: 'DELETE' | 'PATCH', body?: unknown) {
    try { setError(''); await action.mutateAsync({ url, method, body }) } catch (err) { setError(exchangeError(err, t('hospitality.error'))) }
  }
  return <div className="flex flex-col gap-5"><h1 className="text-2xl font-bold">{t('hospitality.watches')}</h1><p className="text-sm text-muted">{t('hospitality.watchHint')}</p>
    <Link className="text-primary underline" to="/exchange">{t('exchange.find')}</Link>
    {watches.isPending ? <p>{t('exchange.matching')}</p> : watches.isError ? <Button onClick={() => watches.refetch()}>{t('common.retry')}</Button> : watches.data.length === 0 ? <p>{t('hospitality.noWatches')}</p> : watches.data.map(watch => <section key={watch.id} className="flex flex-wrap items-end justify-between gap-3 rounded border border-border bg-card p-4"><div><h2 className="font-semibold">{watch.destination}</h2><p>{formatExchangeDate(watch.start, i18n.language)} — {formatExchangeDate(watch.end, i18n.language)}</p></div><SelectField label={t('hospitality.frequency')} value={watch.frequency} disabled={action.isPending} onChange={event => perform(`/exchange/watches/${watch.id}/frequency`, 'PATCH', event.target.value)}>{['Off', 'Immediate', 'Daily', 'Weekly'].map(frequency => <option key={frequency} value={frequency}>{t(`hospitality.frequencies.${frequency}`)}</option>)}</SelectField><Button variant="secondary" disabled={action.isPending} onClick={() => perform(`/exchange/watches/${watch.id}`, 'DELETE')}>{t('hospitality.deleteWatch')}</Button></section>)}
    <h2 className="text-lg font-semibold">{t('hospitality.blocks')}</h2>
    {blocks.isPending ? <p>{t('exchange.matching')}</p> : blocks.isError ? <Button onClick={() => blocks.refetch()}>{t('common.retry')}</Button> : blocks.data.length === 0 ? <p>{t('hospitality.noBlocks')}</p> : blocks.data.map(block => <div key={block.id} className="flex flex-wrap justify-between gap-3 rounded border border-border p-3"><span className="break-all text-sm">{block.displayName ?? t('hospitality.block')}</span><Button variant="secondary" disabled={action.isPending} onClick={() => perform(`/exchange/blocks/${block.blockedUserId}`, 'DELETE')}>{t('hospitality.unblock')}</Button></div>)}
    {error && <p role="alert" className="text-danger">{error}</p>}
  </div>
}
