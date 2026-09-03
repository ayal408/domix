import { create } from 'zustand'
import type { Apartment } from '@/types/api'

export type ChatRole = 'user' | 'model'

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  /** Present when this message renders search results (as apartment cards) instead of plain text. */
  apartments?: Apartment[]
}

interface ChatWidgetState {
  isOpen: boolean
  messages: ChatMessage[]
  isStreaming: boolean
  toggle: () => void
  close: () => void
  addMessage: (role: ChatRole, text: string) => string
  addApartmentResults: (apartments: Apartment[]) => void
  appendToMessage: (id: string, chunk: string) => void
  setStreaming: (streaming: boolean) => void
  reset: () => void
}

let counter = 0

export const useChatWidgetStore = create<ChatWidgetState>((set) => ({
  isOpen: false,
  messages: [],
  isStreaming: false,

  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),

  addMessage: (role, text) => {
    const id = `chat-msg-${++counter}`
    set((state) => ({ messages: [...state.messages, { id, role, text }] }))
    return id
  },

  addApartmentResults: (apartments) => {
    const id = `chat-msg-${++counter}`
    set((state) => ({ messages: [...state.messages, { id, role: 'model', text: '', apartments }] }))
  },

  appendToMessage: (id, chunk) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, text: message.text + chunk } : message,
      ),
    })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  reset: () => set({ messages: [], isStreaming: false }),
}))
