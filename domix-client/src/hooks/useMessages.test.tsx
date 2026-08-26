import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDeleteMessage, useInbox } from '@/hooks/useMessages'
import type { Message } from '@/types/api'

/**
 * Integration test: hook -> service (`messages.api.ts`) -> transport.
 * Only the axios instance itself is mocked, so `messages.api.ts` and
 * `endpoints.ts` run for real — this exercises the same wiring the UI relies on.
 */
vi.mock('@/api/http', () => ({
  dataClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { dataClient } from '@/api/http'

const message: Message = {
  messageId: 'm1',
  senderId: 's1',
  senderName: 'Sender',
  ownerId: 'owner-1',
  ownerName: 'Owner',
  content: 'Hi',
  createdAt: '2024-01-01T00:00:00Z',
  isRead: false,
  isDeleted: false,
  isArchived: false,
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useInbox', () => {
  it('fetches the owner inbox through the endpoint helper and returns the data', async () => {
    vi.mocked(dataClient.get).mockResolvedValue({ data: [message] })

    const { result } = renderHook(() => useInbox('owner-1', { page: 1, pageSize: 20 }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(dataClient.get).toHaveBeenCalledWith(
      '/Message/owner/owner-1',
      expect.objectContaining({ params: { page: 1, pageSize: 20 } }),
    )
    expect(result.current.data).toEqual([message])
  })

  it('does not fire while ownerId is unresolved', () => {
    renderHook(() => useInbox(undefined, { page: 1, pageSize: 20 }), { wrapper })
    expect(dataClient.get).not.toHaveBeenCalled()
  })
})

describe('useDeleteMessage', () => {
  it('calls the delete endpoint with the message id', async () => {
    vi.mocked(dataClient.delete).mockResolvedValue({ data: undefined })

    const { result } = renderHook(() => useDeleteMessage(), { wrapper })
    await result.current.mutateAsync('m1')

    expect(dataClient.delete).toHaveBeenCalledWith('/Message/m1')
  })
})
