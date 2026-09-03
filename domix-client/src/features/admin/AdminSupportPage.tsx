import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSupportTickets, useResolveSupportTicket } from '@/hooks/useSupport'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { formatDate } from '@/lib/format'
import type { Guid, SupportTicket } from '@/types/api'

/** "Ask the team" chat escalations — Admin/Manager only. */
export default function AdminSupportPage() {
  const { t, i18n } = useTranslation()
  const { data: tickets, isLoading } = useSupportTickets()
  const resolveMutation = useResolveSupportTicket()
  const pushToast = useToastStore((state) => state.push)
  const [expandedId, setExpandedId] = useState<Guid | null>(null)

  async function handleResolve(ticketId: Guid) {
    try {
      await resolveMutation.mutateAsync(ticketId)
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  const sorted = [...(tickets ?? [])].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Open' ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('admin.support.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('admin.support.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState title={t('admin.support.empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((ticket) => (
            <TicketCard
              key={ticket.supportTicketId}
              ticket={ticket}
              expanded={expandedId === ticket.supportTicketId}
              onToggle={() =>
                setExpandedId(expandedId === ticket.supportTicketId ? null : ticket.supportTicketId)
              }
              onResolve={() => handleResolve(ticket.supportTicketId)}
              isResolving={resolveMutation.isPending}
              dateLocale={i18n.language}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TicketCard({
  ticket,
  expanded,
  onToggle,
  onResolve,
  isResolving,
  dateLocale,
}: {
  ticket: SupportTicket
  expanded: boolean
  onToggle: () => void
  onResolve: () => void
  isResolving: boolean
  dateLocale: string
}) {
  const { t } = useTranslation()
  const from = ticket.contactName || ticket.userName || ticket.contactEmail || t('admin.support.anonymous')

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{from}</p>
          {ticket.contactEmail && <p className="text-xs text-muted">{ticket.contactEmail}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={ticket.status === 'Open' ? 'warning' : 'success'}>
            {t(`admin.support.status.${ticket.status}`)}
          </Badge>
          <span className="text-xs text-muted">{formatDate(ticket.createdAt, dateLocale)}</span>
        </div>
      </div>

      <p className="text-sm text-foreground">{ticket.message}</p>

      {ticket.transcript && (
        <button type="button" onClick={onToggle} className="w-fit text-xs font-medium text-primary hover:underline">
          {expanded ? t('admin.support.hideTranscript') : t('admin.support.showTranscript')}
        </button>
      )}
      {expanded && ticket.transcript && (
        <pre className="whitespace-pre-wrap rounded bg-card-muted p-3 text-xs text-muted">{ticket.transcript}</pre>
      )}

      {ticket.status === 'Open' && (
        <div className="mt-1 flex justify-end">
          <Button size="sm" variant="secondary" loading={isResolving} onClick={onResolve}>
            {t('admin.support.resolve')}
          </Button>
        </div>
      )}
    </Card>
  )
}
