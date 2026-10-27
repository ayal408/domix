import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dataClient } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import '@/features/account/message-preferences.i18n'

export function MessageIndicator() {
  const { t } = useTranslation('messagePreferences')
  const unread = useQuery({ queryKey: [...queryKeys.messages.all, 'unread-count'],
    queryFn: async ({ signal }) => (await dataClient.get<{ count: number }>('/Message/unread-count', { signal })).data,
    staleTime: 15_000, refetchInterval: 30_000,
  })
  const count = unread.data?.count ?? 0
  return <Link to="/messages" aria-label={`${t('indicator')}${count > 0 ? ` (${count})` : ''}`} className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true"><path d="M4 4h16v12H8l-4 4V4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
    {count > 0 && <span aria-hidden="true" className="absolute end-0 top-0 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold text-primary-foreground">{count > 99 ? '99+' : count}</span>}
  </Link>
}
