import { useTranslation } from 'react-i18next'
import { base64ToImageSrc, initialsOf } from '@/lib/sanitize'
import { formatRelativeTime } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Message } from '@/types/api'

interface Props {
  message: Message
  onMarkRead: (messageId: string) => void
  onArchive?: (messageId: string) => void
  onDelete: (messageId: string) => void
  markReadPending?: boolean
  archivePending?: boolean
  deletePending?: boolean
}

export function MessageItem({
  message,
  onMarkRead,
  onArchive,
  onDelete,
  markReadPending,
  archivePending,
  deletePending,
}: Props) {
  const { t, i18n } = useTranslation()
  const avatar = base64ToImageSrc(message.senderImageBase64)
  const senderLabel = message.senderName?.trim() || t('messages.unknownSender')

  return (
    <Card className={`flex gap-3 p-4 ${message.isRead ? '' : 'border-primary/40 bg-primary/5'}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card-muted text-sm font-semibold text-muted">
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initialsOf(senderLabel)}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{senderLabel}</span>
            {!message.isRead && <Badge tone="primary">{t('messages.unread')}</Badge>}
          </div>
          <span className="text-xs text-muted">{formatRelativeTime(message.createdAt, i18n.language)}</span>
        </div>

        <p className="whitespace-pre-line text-sm text-foreground">{message.content}</p>

        <div className="mt-1 flex flex-wrap gap-2">
          {!message.isRead && (
            <Button variant="secondary" size="sm" loading={markReadPending} onClick={() => onMarkRead(message.messageId)}>
              {t('messages.markRead')}
            </Button>
          )}
          {onArchive && !message.isArchived && (
            <Button variant="secondary" size="sm" loading={archivePending} onClick={() => onArchive(message.messageId)}>
              {t('messages.archive')}
            </Button>
          )}
          <Button variant="ghost" size="sm" loading={deletePending} onClick={() => onDelete(message.messageId)}>
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
