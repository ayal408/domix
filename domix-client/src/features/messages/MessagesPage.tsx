import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth.store'
import {
  useArchiveMessage,
  useArchivedMessages,
  useDeleteMessage,
  useInbox,
  useMarkMessageAsRead,
} from '@/hooks/useMessages'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { MessageItem } from '@/features/messages/MessageItem'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/cn'
import type { Guid } from '@/types/api'

const PAGE_SIZE = 20

type Tab = 'inbox' | 'archived'

const tabClasses = (active: boolean) =>
  cn(
    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
    active ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-card-muted',
  )

export default function MessagesPage() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const pushToast = useToastStore((state) => state.push)

  const [tab, setTab] = useState<Tab>('inbox')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Guid | null>(null)

  const ownerId = user?.userId

  const inbox = useInbox(ownerId, { page, pageSize: PAGE_SIZE })
  const archived = useArchivedMessages(ownerId, tab === 'archived')

  const markRead = useMarkMessageAsRead()
  const archive = useArchiveMessage()
  const removeMessage = useDeleteMessage()

  if (!user) return null

  const active = tab === 'inbox' ? inbox : archived
  const messages = active.data ?? []

  function switchTab(next: Tab) {
    setTab(next)
    setPage(1)
  }

  function reportError(error: unknown) {
    const apiError = toApiError(error)
    pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
  }

  async function handleMarkRead(messageId: Guid) {
    try {
      await markRead.mutateAsync(messageId)
    } catch (error) {
      reportError(error)
    }
  }

  async function handleArchive(messageId: Guid) {
    try {
      await archive.mutateAsync(messageId)
      pushToast({ variant: 'success', title: t('messages.archived') })
    } catch (error) {
      reportError(error)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await removeMessage.mutateAsync(deleteTarget)
      pushToast({ variant: 'success', title: t('messages.deleted') })
    } catch (error) {
      reportError(error)
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('messages.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('messages.subtitle')}</p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
        <button type="button" className={tabClasses(tab === 'inbox')} onClick={() => switchTab('inbox')}>
          {t('messages.tabs.inbox')}
        </button>
        <button type="button" className={tabClasses(tab === 'archived')} onClick={() => switchTab('archived')}>
          {t('messages.tabs.archived')}
        </button>
      </div>

      {active.isError ? (
        <EmptyState
          title={t('messages.loadError')}
          action={
            <Button variant="secondary" onClick={() => active.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : active.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          title={tab === 'inbox' ? t('messages.empty.inbox') : t('messages.empty.archived')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <MessageItem
              key={message.messageId}
              message={message}
              onMarkRead={handleMarkRead}
              onArchive={tab === 'inbox' ? handleArchive : undefined}
              onDelete={setDeleteTarget}
              markReadPending={markRead.isPending && markRead.variables === message.messageId}
              archivePending={archive.isPending && archive.variables === message.messageId}
              deletePending={removeMessage.isPending && removeMessage.variables === message.messageId}
            />
          ))}
        </div>
      )}

      {tab === 'inbox' && messages.length > 0 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            {t('messages.pagination.previous')}
          </Button>
          <span className="text-sm text-muted">{t('messages.pagination.page', { page })}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={messages.length < PAGE_SIZE}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('messages.pagination.next')}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('messages.deleteConfirmTitle')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={removeMessage.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
