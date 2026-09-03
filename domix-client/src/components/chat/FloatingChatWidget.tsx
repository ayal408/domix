import { useEffect, useRef, useState } from 'react'
import { Transition } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useChat } from '@/hooks/useChat'
import { useChatWidgetStore } from '@/stores/chatWidget.store'
import { useCreateSupportTicket } from '@/hooks/useSupport'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { ApartmentCard } from '@/features/apartments/ApartmentCard'

export function FloatingChatWidget() {
  const { t } = useTranslation()
  const { isOpen, messages, isStreaming, toggle, close } = useChatWidgetStore()
  const { sendMessage, cancel } = useChat()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'chat' | 'contact'>('chat')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, isOpen])

  useEffect(() => {
    if (!isOpen) setMode('chat')
  }, [isOpen])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!input.trim() || isStreaming) return
    void sendMessage(input)
    setInput('')
  }

  return (
    <div className="fixed bottom-4 end-4 z-40 flex flex-col items-end gap-3">
      <Transition
        show={isOpen}
        enter="ease-out duration-150"
        enterFrom="opacity-0 translate-y-2 scale-95"
        enterTo="opacity-100 translate-y-0 scale-100"
        leave="ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0 scale-100"
        leaveTo="opacity-0 translate-y-2 scale-95"
      >
        <div className="flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {mode === 'chat' ? t('chat.title') : t('chat.contactTeam.title')}
              </p>
              <p className="text-xs text-muted">{mode === 'chat' ? t('chat.disclaimer') : t('chat.contactTeam.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t('common.close')}
              className="rounded p-1 text-muted hover:bg-card-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>

          {mode === 'chat' ? (
            <>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {messages.length === 0 && (
                  <p className="text-sm text-muted">{t('chat.emptyState')}</p>
                )}
                {messages.map((message) =>
                  message.apartments ? (
                    <div key={message.id} className="me-auto flex w-full flex-col gap-2">
                      <p className="text-xs font-medium text-muted">
                        {message.apartments.length > 0
                          ? t('chat.search.resultsHeading', { count: message.apartments.length })
                          : t('chat.search.noResults')}
                      </p>
                      {message.apartments.map((apartment) => (
                        <ApartmentCard key={apartment.apartmentId} apartment={apartment} />
                      ))}
                    </div>
                  ) : (
                    <div
                      key={message.id}
                      className={cn(
                        'w-fit max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                        message.role === 'user'
                          ? 'ms-auto bg-primary text-primary-foreground'
                          : 'me-auto bg-card-muted text-foreground',
                      )}
                    >
                      {message.text || (isStreaming ? <Spinner className="h-4 w-4" /> : null)}
                    </div>
                  ),
                )}
              </div>

              <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border p-3">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={t('chat.inputPlaceholder')}
                  disabled={isStreaming}
                  className="h-10 flex-1 rounded border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {isStreaming ? (
                  <Button type="button" size="sm" variant="secondary" onClick={cancel}>
                    {t('chat.stop')}
                  </Button>
                ) : (
                  <Button type="submit" size="sm" disabled={!input.trim()}>
                    {t('chat.send')}
                  </Button>
                )}
              </form>
              <div className="border-t border-border px-4 py-2 text-center">
                <button
                  type="button"
                  onClick={() => setMode('contact')}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t('chat.contactTeam.trigger')}
                </button>
              </div>
            </>
          ) : (
            <ContactTeamForm onCancel={() => setMode('chat')} onSent={() => setMode('chat')} />
          )}
        </div>
      </Transition>

      <button
        type="button"
        onClick={toggle}
        aria-label={t('chat.title')}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:bg-primary-hover"
      >
        <ChatBubbleIcon className="h-6 w-6" />
      </button>
    </div>
  )
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 4h16v12H8l-4 4V4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ContactTeamForm({ onCancel, onSent }: { onCancel: () => void; onSent: () => void }) {
  const { t } = useTranslation()
  const messages = useChatWidgetStore((state) => state.messages)
  const currentUser = useAuthStore((state) => state.user)
  const createTicket = useCreateSupportTicket()
  const pushToast = useToastStore((state) => state.push)
  const [message, setMessage] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const needsContactInfo = !currentUser

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!message.trim() || (needsContactInfo && !contactEmail.trim())) return

    try {
      await createTicket.mutateAsync({
        message: message.trim(),
        contactName: needsContactInfo ? contactName.trim() || undefined : undefined,
        contactEmail: needsContactInfo ? contactEmail.trim() : undefined,
        transcript:
          messages.length > 0
            ? messages.filter((m) => !m.apartments).map((m) => ({ role: m.role, text: m.text }))
            : undefined,
      })
      pushToast({ variant: 'success', title: t('chat.contactTeam.sent') })
      onSent()
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
      {needsContactInfo && (
        <>
          <input
            type="text"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder={t('chat.contactTeam.namePlaceholder')}
            className="h-9 rounded border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="email"
            required
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder={t('chat.contactTeam.emailPlaceholder')}
            className="h-9 rounded border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </>
      )}
      <textarea
        required
        rows={5}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={t('chat.contactTeam.messagePlaceholder')}
        className="flex-1 resize-none rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={createTicket.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" loading={createTicket.isPending}>
          {t('chat.contactTeam.send')}
        </Button>
      </div>
    </form>
  )
}
