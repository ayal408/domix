import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { dataClient } from '@/api/http'
import i18n from '@/i18n'
import { MessagePreferences } from './MessagePreferences'
vi.mock('@/api/http', () => ({ dataClient: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: (selector: (state: { user: { userId: string } }) => unknown) => selector({ user: { userId: 'me' } }) }))
beforeEach(async () => { vi.resetAllMocks(); await i18n.changeLanguage('en'); vi.mocked(dataClient.get).mockResolvedValue({ data: { receiveMessageEmails: true } }) })
function open() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MessagePreferences /></QueryClientProvider>) }
it('saves the email opt-out without sending an account identifier', async () => {
  vi.mocked(dataClient.patch).mockResolvedValue({}); open(); const user = userEvent.setup(); const input = await screen.findByRole('checkbox')
  await waitFor(() => expect(input).toBeChecked()); await user.click(input)
  await waitFor(() => expect(input).not.toBeChecked())
  expect(dataClient.patch).toHaveBeenCalledWith('/privacy/message-preferences', { receiveMessageEmails: false })
})
it('keeps the saved preference visible and reports failure when saving fails', async () => {
  vi.mocked(dataClient.patch).mockRejectedValue(new Error('offline')); open(); const user = userEvent.setup(); const input = await screen.findByRole('checkbox')
  await waitFor(() => expect(input).toBeChecked()); await user.click(input); await screen.findByRole('alert'); expect(input).toBeChecked()
})
