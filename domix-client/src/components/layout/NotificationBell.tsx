import { CloseButton, Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { useNotificationFeed, useMarkNotificationsSeen, useDismissNotifications } from '@/hooks/useNotifications'
import { formatDate } from '@/lib/format'
import '@/features/auth/auth.design.i18n'
import { EmptyState } from '@/components/ui/EmptyState'

/** Bell icon with an unread badge — see PresenceHub's `NotificationPosted` broadcast for the live push. */
export function NotificationBell() {
  const { t, i18n } = useTranslation()
  const { t: text } = useTranslation('authDesign')
  const { data } = useNotificationFeed()
  const markSeen = useMarkNotificationsSeen()
  const dismiss = useDismissNotifications()

  const unreadCount = data?.unreadCount ?? 0

  function handleButtonClick() {
    // Fires on both open and close — harmless either way, and marking-seen is idempotent server-side.
    if (unreadCount > 0) markSeen.mutate()
  }

  return (
    <Popover className="relative">
      {({ close }) => <>
      <PopoverButton
        onClick={handleButtonClick}
        className="relative flex h-9 w-9 items-center justify-center rounded text-foreground hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('notifications.title')}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        focus
        role="dialog"
        aria-label={t('notifications.title')}
        className="domix-scroll-list z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-2 shadow-lg"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-2 pb-2">
          <p className="text-sm font-semibold text-foreground">{t('notifications.title')}</p>
          <CloseButton aria-label={t('common.close')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-muted hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden="true">×</span>
          </CloseButton>
        </div>
        {!!data?.notifications.length && <button type="button" disabled={dismiss.isPending} onClick={() => {
          const through = data.notifications.reduce((latest, item) => item.createdAt > latest ? item.createdAt : latest, data.notifications[0]!.createdAt)
          dismiss.mutate(through, { onSuccess: () => close() })
        }} className="my-2 rounded px-2 py-2 text-sm text-primary hover:bg-card-muted disabled:opacity-50">{text('clearNotifications')}</button>}
        {dismiss.isError && <p role="alert" className="px-2 py-2 text-sm text-danger">{text('clearFailed')}</p>}
        {!data || data.notifications.length === 0 ? (
          <EmptyState title={t('notifications.empty')} />
        ) : (
          <div className="space-y-1">
            {data.notifications.map((n) => (
              <div key={n.notificationId} className="rounded px-2 py-2 hover:bg-card-muted">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted">{n.message}</p>
                <p className="mt-1 text-xs text-muted">{formatDate(n.createdAt, i18n.language)}</p>
              </div>
            ))}
          </div>
        )}
      </PopoverPanel>
      </>}
    </Popover>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
