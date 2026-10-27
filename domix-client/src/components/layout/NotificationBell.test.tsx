vi.mock('@/features/community/useReturnNotifications',()=>({useReturnNotifications:()=>({count:0,alerts:{data:[]},visits:{data:[]}})}))
vi.mock('@/features/community/ReturnNotifications',()=>({ReturnNotifications:()=>null}))
vi.mock('@/features/community/useRenewals', () => ({ useRenewals: () => ({ data: [] }) }))
vi.mock('@/features/community/RenewalReminders', () => ({ RenewalReminders: () => null }))
import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { NotificationBell } from './NotificationBell'

const dismiss = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useNotifications', () => ({
  useNotificationFeed: () => ({ data: { unreadCount: 0, notifications: [{ notificationId: 'one', title: 'Old announcement', message: 'Hello', createdAt: '2026-01-01T00:00:00Z' }] } }),
  useMarkNotificationsSeen: () => ({ mutate: vi.fn() }),
  useDismissNotifications: () => ({ mutate: dismiss, isPending: false, isError: false }),
}))
beforeEach(async () => { vi.clearAllMocks(); dismiss.mockReset(); await i18n.changeLanguage('en'); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
it('closes explicitly and restores focus to the bell', async () => {
  render(<NotificationBell />); const user = userEvent.setup(); const bell = screen.getByRole('button', { name: 'Notifications' })
  await user.click(bell); await screen.findByRole('dialog'); await user.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(bell).toHaveFocus()
})
it('closes with Escape and an outside click', async () => {
  render(<><NotificationBell /><button>Outside</button></>); const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Notifications' })); await screen.findByRole('dialog'); await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: 'Notifications' })); await screen.findByRole('dialog'); await user.click(screen.getByText('Outside'))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
it('clears only through the latest displayed timestamp', async () => {
  render(<NotificationBell />); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Notifications' }))
  await user.click(await screen.findByRole('button', { name: 'Clear my notifications' })); expect(dismiss).toHaveBeenCalledWith('2026-01-01T00:00:00Z', { onSuccess: expect.any(Function) })
})

it('closes after successful cleanup so removed controls cannot strand focus', async () => {
  dismiss.mockImplementation((_through, options) => options.onSuccess())
  render(<NotificationBell />); const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Notifications' }))
  await user.click(await screen.findByRole('button', { name: 'Clear my notifications' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Notifications' })).toHaveFocus()
})
