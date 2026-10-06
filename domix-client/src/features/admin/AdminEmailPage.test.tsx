import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n'
import * as emailApi from '@/api/email.api'
import AdminEmailPage from './AdminEmailPage'

vi.mock('@/api/email.api')
const settings: emailApi.EmailSettings = {
  senderEmail: 'system@example.com', senderName: 'DOMIX', replyTo: '', signature: '',
  testSubject: 'Test', testBody: 'Hello {{Email}}', connected: true, enabled: true,
  oauthAvailable: true, updatedAt: '2026-10-06T00:00:00Z',
}
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter><AdminEmailPage /></MemoryRouter></QueryClientProvider>)
}
beforeEach(async () => {
  vi.resetAllMocks()
  await i18n.changeLanguage('en')
  vi.mocked(emailApi.getEmailSettings).mockResolvedValue(settings)
  vi.mocked(emailApi.getEmailHistory).mockResolvedValue([])
})
describe('System sender administration', () => {
  it('saves display settings without sending credentials or an editable account address', async () => {
    vi.mocked(emailApi.saveEmailSettings).mockResolvedValue({ ...settings, senderName: 'DOMIX Team' })
    open()
    const name = await screen.findByLabelText(/Sender name/)
    const user = userEvent.setup()
    await user.clear(name)
    await user.type(name, 'DOMIX Team')
    await user.click(screen.getByRole('button', { name: 'Save sender settings' }))
    await waitFor(() => expect(emailApi.saveEmailSettings).toHaveBeenCalled())
    expect(vi.mocked(emailApi.saveEmailSettings).mock.calls[0]?.[0]).toEqual({
      senderName: 'DOMIX Team', replyTo: '', signature: '', testSubject: 'Test', testBody: 'Hello {{Email}}',
    })
    expect(screen.getByText('system@example.com')).toBeInTheDocument()
    expect(screen.getByText('You can use {{DateTime}} and {{Email}} placeholders.')).toBeInTheDocument()
  })
  it('sends the test to the chosen recipient and refreshes delivery history', async () => {
    vi.mocked(emailApi.sendTestEmail).mockResolvedValue(undefined)
    open()
    const recipient = await screen.findByLabelText(/Test recipient/)
    const user = userEvent.setup()
    await user.type(recipient, 'tester@example.com')
    await user.click(screen.getByRole('button', { name: 'Send test email' }))
    await waitFor(() => expect(emailApi.sendTestEmail).toHaveBeenCalled())
    expect(vi.mocked(emailApi.sendTestEmail).mock.calls[0]?.[0]).toBe('tester@example.com')
    await waitFor(() => expect(emailApi.getEmailHistory).toHaveBeenCalledTimes(2))
  })
  it('disables test sending when the system account is disconnected', async () => {
    vi.mocked(emailApi.getEmailSettings).mockResolvedValue({ ...settings, connected: false, enabled: false })
    open()
    expect(await screen.findByRole('button', { name: 'Send test email' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Connect Gmail' })).toBeEnabled()
  })
})
