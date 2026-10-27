import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dataClient } from '@/api/http'
import { useAuthStore } from '@/stores/auth.store'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import './message-preferences.i18n'

export function MessagePreferences() {
  const { t } = useTranslation('messagePreferences')
  const userId = useAuthStore(state => state.user?.userId)
  const client = useQueryClient()
  const key = ['message-email-preference', userId]
  const preference = useQuery({ queryKey: key, enabled: !!userId,
    queryFn: async ({ signal }) => (await dataClient.get<{ receiveMessageEmails: boolean }>('/privacy/message-preferences', { signal })).data,
  })
  const save = useMutation({ mutationFn: async (receiveMessageEmails: boolean) => {
    await dataClient.patch('/privacy/message-preferences', { receiveMessageEmails })
    return { receiveMessageEmails }
  }, onSuccess: value => { client.setQueryData(key, value) } })
  return <Card className="flex flex-col gap-3 p-5 sm:p-6">
    <h2 className="font-semibold">{t('title')}</h2>
    <label className="flex items-start gap-3 text-sm leading-relaxed">
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" checked={preference.data?.receiveMessageEmails ?? false}
        disabled={!preference.data || save.isPending} onChange={event => save.mutate(event.target.checked)} />
      {t('email')}
    </label>
    <p className="text-sm leading-relaxed text-muted">{t('hint')}</p>
    {preference.isError && <div><p role="alert" className="text-sm text-danger">{t('loadFailed')}</p><Button variant="ghost" onClick={() => void preference.refetch()}>{t('retry')}</Button></div>}
    {save.isError && <p role="alert" className="text-sm text-danger">{t('failed')}</p>}
  </Card>
}
