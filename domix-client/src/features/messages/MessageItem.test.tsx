import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageItem } from '@/features/messages/MessageItem'
import type { Message } from '@/types/api'

const baseMessage: Message = {
  messageId: 'm1',
  senderId: 's1',
  senderName: 'Alex',
  ownerId: 'owner-1',
  ownerName: 'Owner',
  content: 'Is this apartment still available?',
  createdAt: new Date().toISOString(),
  isRead: false,
  isDeleted: false,
  isArchived: false,
}

describe('MessageItem', () => {
  it('renders the sender, content and an unread badge for an unread message', () => {
    render(<MessageItem message={baseMessage} onMarkRead={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(screen.getByText('Is this apartment still available?')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeInTheDocument()
  })

  it('hides the unread badge and mark-as-read action for a read message', () => {
    render(<MessageItem message={{ ...baseMessage, isRead: true }} onMarkRead={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.queryByText('New')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark as read' })).not.toBeInTheDocument()
  })

  it('falls back to a placeholder when the sender name is missing', () => {
    render(<MessageItem message={{ ...baseMessage, senderName: null }} onMarkRead={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Unknown sender')).toBeInTheDocument()
  })

  it('calls onMarkRead with the message id when clicked', async () => {
    const onMarkRead = vi.fn()
    render(<MessageItem message={baseMessage} onMarkRead={onMarkRead} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Mark as read' }))
    expect(onMarkRead).toHaveBeenCalledWith('m1')
  })

  it('only shows the archive action when onArchive is supplied and the message is not already archived', () => {
    const { rerender } = render(
      <MessageItem message={baseMessage} onMarkRead={vi.fn()} onDelete={vi.fn()} onArchive={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()

    rerender(
      <MessageItem
        message={{ ...baseMessage, isArchived: true }}
        onMarkRead={vi.fn()}
        onDelete={vi.fn()}
        onArchive={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  })

  it('calls onDelete with the message id when clicked', async () => {
    const onDelete = vi.fn()
    render(<MessageItem message={baseMessage} onMarkRead={vi.fn()} onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith('m1')
  })
})
