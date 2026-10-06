import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { InputField, TextareaField } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { toApiError } from '@/api/errors'
import { useToastStore } from '@/stores/toast.store'
import { formatDate } from '@/lib/format'
import * as emailApi from '@/api/email.api'
import './email.i18n'

const settingsKey = ['admin', 'email', 'settings']
const historyKey = ['admin', 'email', 'history']

function SenderForm({ settings }: { settings: emailApi.EmailSettings }) {
  const { t } = useTranslation('email')
  const queryClient = useQueryClient()
  const pushToast = useToastStore((s) => s.push)
  const [input, setInput] = useState<emailApi.EmailSettingsInput>({
    senderName: settings.senderName, replyTo: settings.replyTo, signature: settings.signature,
    testSubject: settings.testSubject, testBody: settings.testBody,
  })
  const save = useMutation({ mutationFn: emailApi.saveEmailSettings })
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const result = await save.mutateAsync(input)
      queryClient.setQueryData(settingsKey, result)
      pushToast({ variant: 'success', title: t('saved') })
    } catch (error) {
      pushToast({ variant: 'error', title: t(`errors.${toApiError(error).code}`, { defaultValue: t('error') }) })
    }
  }
  return <form className="flex flex-col gap-5" onSubmit={submit}>
    <InputField label={t('senderName')} value={input.senderName} required maxLength={100}
      onChange={(e) => setInput({ ...input, senderName: e.target.value })} />
    <InputField label={t('replyTo')} type="email" maxLength={254} value={input.replyTo}
      onChange={(e) => setInput({ ...input, replyTo: e.target.value })} />
    <TextareaField label={t('signature')} rows={3} maxLength={2000} value={input.signature}
      onChange={(e) => setInput({ ...input, signature: e.target.value })} />
    <details className="rounded border border-border p-4">
      <summary className="cursor-pointer text-sm font-semibold">{t('template')}</summary>
      <div className="mt-4 flex flex-col gap-4">
        <InputField label={t('subject')} required maxLength={200} value={input.testSubject}
          onChange={(e) => setInput({ ...input, testSubject: e.target.value })} />
        <TextareaField label={t('body')} required maxLength={5000} value={input.testBody}
          hint={t('templateHint', { DateTime: '{{DateTime}}', Email: '{{Email}}' })}
          onChange={(e) => setInput({ ...input, testBody: e.target.value })} />
      </div>
    </details>
    <div><Button type="submit" loading={save.isPending}>{t('save')}</Button></div>
  </form>
}

export default function AdminEmailPage() {
  const { t, i18n } = useTranslation('email')
  const queryClient = useQueryClient()
  const pushToast = useToastStore((s) => s.push)
  const [params, setParams] = useSearchParams()
  const [recipient, setRecipient] = useState('')
  const settings = useQuery({ queryKey: settingsKey, queryFn: emailApi.getEmailSettings })
  const history = useQuery({ queryKey: historyKey, queryFn: emailApi.getEmailHistory })
  const connect = useMutation({ mutationFn: emailApi.connectGmail })
  const disconnect = useMutation({ mutationFn: emailApi.disconnectGmail })
  const test = useMutation({ mutationFn: emailApi.sendTestEmail })

  useEffect(() => {
    const status = params.get('gmail')
    if (!status) return
    pushToast({ variant: status === 'connected' ? 'success' : 'error', title: t(status === 'connected' ? 'consentSuccess' : 'consentFailed') })
    const next = new URLSearchParams(params)
    next.delete('gmail')
    setParams(next, { replace: true })
  }, [params, setParams, pushToast, t])

  const showError = (error: unknown) => pushToast({ variant: 'error', title: t(`errors.${toApiError(error).code}`, { defaultValue: t('error') }) })
  async function handleConnect() {
    try {
      const result = await connect.mutateAsync()
      // The server creates a one-use consent state bound to the signed-in administrator.
      window.location.assign(result.authorizationUrl)
    } catch (error) { showError(error) }
  }
  async function handleDisconnect() {
    if (!window.confirm(t('confirmDisconnect'))) return
    try {
      await disconnect.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: settingsKey })
      pushToast({ variant: 'success', title: t('disconnectedSuccess') })
    } catch (error) { showError(error) }
  }
  async function handleTest(event: FormEvent) {
    event.preventDefault()
    try {
      await test.mutateAsync(recipient)
      pushToast({ variant: 'success', title: t('sent') })
    } catch (error) { showError(error) }
    finally { await queryClient.invalidateQueries({ queryKey: historyKey }) }
  }

  return <div className="flex flex-col gap-6">
    <div><h1 className="text-2xl font-bold text-foreground">{t('title')}</h1><p className="mt-1 text-sm text-muted">{t('subtitle')}</p></div>
    {settings.isLoading ? <Skeleton className="h-64 w-full" /> : settings.isError ?
      <Card className="p-6"><p role="alert">{t('error')}</p><Button onClick={() => void settings.refetch()}>{t('retry')}</Button></Card> : settings.data && <>
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t('account')}</h2><span className="text-sm text-muted">{t(settings.data.connected ? 'connected' : 'disconnected')}</span></div>
        {settings.data.senderEmail && <p dir="ltr" className="text-start text-sm">{settings.data.senderEmail}</p>}
        <div className="flex flex-wrap gap-2"><Button disabled={!settings.data.oauthAvailable || disconnect.isPending} loading={connect.isPending} onClick={() => void handleConnect()}>{t(settings.data.connected ? 'switchAccount' : 'connect')}</Button>
          {settings.data.connected && <Button variant="danger" disabled={connect.isPending} loading={disconnect.isPending} onClick={() => void handleDisconnect()}>{t('disconnect')}</Button>}</div>
        {!settings.data.oauthAvailable && <p className="text-sm text-muted">{t('noKeys')}</p>}
      </Card>
      <Card className="p-6"><SenderForm key={settings.data.updatedAt} settings={settings.data} /></Card>
      <Card className="p-6"><h2 className="mb-4 font-semibold">{t('testTitle')}</h2><form onSubmit={handleTest} className="flex flex-col gap-4">
        <InputField type="email" label={t('recipient')} required maxLength={254} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        <div><Button type="submit" loading={test.isPending} disabled={!settings.data.connected}>{t('sendTest')}</Button></div>
      </form></Card>
    </>}
    <Card className="overflow-hidden p-6"><h2 className="mb-4 font-semibold">{t('history')}</h2>
      {history.isLoading ? <Skeleton className="h-24 w-full" /> : history.isError ? <p role="alert">{t('error')}</p> : !history.data?.length ? <p className="text-sm text-muted">{t('emptyHistory')}</p> :
        <div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr className="border-b border-border text-muted"><th className="p-2 text-start">{t('date')}</th><th className="p-2 text-start">{t('to')}</th><th className="p-2 text-start">{t('subject')}</th><th className="p-2 text-start">{t('status')}</th></tr></thead>
          <tbody>{history.data.map((delivery) => <tr key={delivery.id} className="border-b border-border"><td className="whitespace-nowrap p-2">{formatDate(delivery.createdAt, i18n.language)}</td><td dir="ltr" className="p-2">{delivery.recipient}</td><td className="p-2">{delivery.subject}</td><td className="p-2">{t(delivery.succeeded ? 'success' : 'failure')}</td></tr>)}</tbody></table></div>}
    </Card>
  </div>
}
