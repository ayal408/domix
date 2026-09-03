import { env } from '@/config/env'
import { apiEndpoints } from '@/api/endpoints'
import type { ChatRole } from '@/stores/chatWidget.store'
import type { Apartment } from '@/types/api'

export interface ChatTurn {
  role: ChatRole
  text: string
}

export type ChatStreamEvent = { type: 'text'; text: string } | { type: 'apartments'; apartments: Apartment[] }

/**
 * The chat endpoint streams Server-Sent Events over a plain POST (not
 * EventSource, since it needs a JSON body). Each event's `data:` line(s) are
 * reassembled and yielded as they arrive so the UI can render token-by-token.
 * A block with an `event: apartments` line carries a JSON array of matching
 * listings instead of plain text (see ChatController.StreamReply).
 */
export async function* streamChatReply(
  history: ChatTurn[],
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch(`${env.apiUrl}${apiEndpoints.chat.stream()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history }),
    signal,
  })

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Chat request failed with status ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      const lines = event.split('\n')
      const isApartments = lines[0]?.startsWith('event: apartments')
      const dataLines = isApartments ? lines.slice(1) : lines

      const text = dataLines
        .map((line) => (line.startsWith('data: ') ? line.slice(6) : line))
        .join('\n')
      if (!text) continue

      if (isApartments) {
        try {
          yield { type: 'apartments', apartments: JSON.parse(text) as Apartment[] }
        } catch {
          // Malformed payload — drop it rather than surfacing broken JSON as chat text.
        }
      } else {
        yield { type: 'text', text }
      }
    }
  }
}
