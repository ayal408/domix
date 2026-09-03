import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNotificationFeed, useCreateNotification } from '@/hooks/useNotifications'
import { InputField, TextareaField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { formatDate } from '@/lib/format'

/** Broadcasts an announcement to every signed-in user, live over PresenceHub. Admin/Manager only. */
export default function AdminNotificationsPage() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useNotificationFeed()
  const createMutation = useCreateNotification()
  const pushToast = useToastStore((state) => state.push)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || !message.trim()) return

    try {
      await createMutation.mutateAsync({ title: title.trim(), message: message.trim() })
      pushToast({ variant: 'success', title: t('admin.notifications.sent') })
      setTitle('')
      setMessage('')
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('admin.notifications.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('admin.notifications.subtitle')}</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <InputField
            label={t('admin.notifications.fieldTitle')}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <TextareaField
            label={t('admin.notifications.fieldMessage')}
            required
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={createMutation.isPending} disabled={!title.trim() || !message.trim()}>
              {t('admin.notifications.send')}
            </Button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.notifications.length === 0 ? (
        <EmptyState title={t('admin.notifications.empty')} />
      ) : (
        <div className="flex flex-col gap-2">
          {data.notifications.map((n) => (
            <Card key={n.notificationId} className="p-4">
              <p className="text-sm font-semibold text-foreground">{n.title}</p>
              <p className="mt-0.5 text-sm text-muted">{n.message}</p>
              <p className="mt-1 text-xs text-muted">{formatDate(n.createdAt, i18n.language)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
