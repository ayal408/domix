import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { streamChatReply } from '@/api/chat.api'
import { useChatWidgetStore } from '@/stores/chatWidget.store'
import { useToastStore } from '@/stores/toast.store'

/**
 * A slow filtering proxy on the network path (see IsraeliAddressService's NetFree note — this app
 * routinely sees 8-35s round trips on that kind of network) can legitimately delay the first chunk,
 * but a genuinely stuck connection must not spin forever with no way out. This bounds the wait and
 * a visible cancel button (see FloatingChatWidget) covers the rest.
 */
const RESPONSE_TIMEOUT_MS = 60_000

export function useChat() {
  const { t } = useTranslation()
  const pushToast = useToastStore((state) => state.push)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const { messages, addMessage, addApartmentResults, appendToMessage, setStreaming } =
        useChatWidgetStore.getState()

      addMessage('user', trimmed)
      // Apartment-result messages are UI-only artifacts, not real conversation turns.
      const history = [...messages, { id: '', role: 'user' as const, text: trimmed, apartments: undefined }]
        .filter((m) => !m.apartments)
        .map((m) => ({ role: m.role, text: m.text }))

      const assistantId = addMessage('model', '')
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller
      let timedOut = false
      const timeoutId = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, RESPONSE_TIMEOUT_MS)

      try {
        for await (const event of streamChatReply(history, controller.signal)) {
          // An event arrived — the connection is alive, so give it a fresh window rather than
          // timing out mid-stream on a slow-but-working response.
          clearTimeout(timeoutId)
          if (event.type === 'apartments') {
            addApartmentResults(event.apartments)
          } else {
            appendToMessage(assistantId, event.text)
          }
        }
      } catch (error) {
        const wasAborted = error instanceof DOMException && error.name === 'AbortError'
        if (wasAborted && timedOut) {
          pushToast({ variant: 'error', title: t('chat.timeout') })
        } else if (!wasAborted) {
          pushToast({ variant: 'error', title: t('chat.error') })
        }
        // A manual cancel (aborted, not timed out) shows nothing — the user asked for exactly this.
      } finally {
        clearTimeout(timeoutId)
        setStreaming(false)
        abortRef.current = null
      }
    },
    [pushToast, t],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { sendMessage, cancel }
}
