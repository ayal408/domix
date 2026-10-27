import { expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ContactDetailsFields } from './ContactDetailsFields'
import { EMPTY_CONTACT, withContactDetails } from './contactDetails'
import { ReplyMessageDialog } from './ReplyMessageDialog'
import { useReplyMessage } from '@/hooks/useMessages'
vi.mock('@/hooks/useMessages', () => ({ useReplyMessage: vi.fn() }))
it('includes contact details only after explicit opt-in, including when previously entered details remain in state', async () => {
  const labels = { email: 'Email', phone: 'Phone' }
  expect(withContactDetails(' hello ', { share: false, email: 'a@example.com', phone: '0501234567' }, labels)).toBe('hello')
  expect(withContactDetails('hello', { share: true, email: ' a@example.com ', phone: '' }, labels)).toBe('hello\n\nEmail: a@example.com')
  function Form() { const [value, setValue] = useState(EMPTY_CONTACT); return <ContactDetailsFields value={value} onChange={setValue} /> }
  render(<Form />); const user = userEvent.setup()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  await user.click(screen.getByRole('checkbox'))
  expect(screen.getByLabelText('Contact email')).toHaveValue(''); expect(screen.getByLabelText('Contact phone')).toHaveValue('')
  await user.type(screen.getByLabelText('Contact email'), 'a@example.com'); await user.click(screen.getByRole('checkbox'))
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})
it('routes a reply only by original message ID and preserves the draft on failure', async () => {
  const send = vi.fn().mockRejectedValue(new Error('network')); const close = vi.fn()
  vi.mocked(useReplyMessage).mockReturnValue({ mutateAsync: send, isPending: false } as unknown as ReturnType<typeof useReplyMessage>)
  render(<ReplyMessageDialog message={{ messageId: 'original', senderId: '00000000-0000-0000-0000-000000000000', ownerId: 'me', senderIsAnonymous: true, content: 'Original', createdAt: new Date().toISOString(), isRead: false, isDeleted: false, isArchived: false }} onClose={close} />)
  const user = userEvent.setup(); await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Please arrange a visit')
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(send).toHaveBeenCalledWith({ messageId: 'original', content: 'Please arrange a visit' }))
  expect(close).not.toHaveBeenCalled(); expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Please arrange a visit')
  send.mockResolvedValue({}); await user.click(screen.getByRole('checkbox')); await user.type(screen.getByLabelText('Contact phone'), '0501234567')
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(close).toHaveBeenCalled())
  expect(send.mock.lastCall?.[0]).toEqual({ messageId: 'original', content: 'Please arrange a visit\n\nContact phone: 0501234567' })
})
