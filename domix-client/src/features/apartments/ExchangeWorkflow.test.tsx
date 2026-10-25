import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExchangeProposalForm } from './ExchangeProposalForm'
import ExchangeRequestsPage from './ExchangeRequestsPage'
import { useAuthStore } from '@/stores/auth.store'
import { dataClient } from '@/api/http'

const home = { apartmentId: 'mine', userId: 'me', listingType: 'Exchange', status: 'Available', city: 'Haifa', address: 'Main 1' }
vi.mock('@/hooks/useApartments', () => ({ useApartments: () => ({ data: [{ apartmentId: 'mine', userId: 'me', listingType: 'Exchange', status: 'Available', city: 'Haifa', address: 'Main 1' }], isLoading: false }) }))
vi.mock('@/components/ui/HebrewDateField', () => ({ HebrewDateField: ({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (s: string) => void }) => <label>{label}<input type="date" name={name} value={value} onChange={e => onChange(e.target.value)} /></label> }))
function wrap(node: React.ReactNode) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>) }
const pending = { id: 'request', requesterId: 'other', recipientId: 'me', offeredApartmentId: 'other-home', requestedApartmentId: home.apartmentId, offeredHome: 'Jerusalem', requestedHome: 'Haifa', start: '2099-01-01', end: '2099-01-05', guests: 3, note: '', status: 'Pending', revision: 2 }
beforeEach(() => {
  vi.restoreAllMocks()
  useAuthStore.setState({ status: 'authenticated', user: { userId: 'me' } as never })
  vi.spyOn(dataClient, 'get').mockResolvedValue({ data: [pending] })
  vi.spyOn(dataClient, 'request').mockResolvedValue({ data: {} })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
describe('exchange consent and decisions', () => {
  it('requires explicit consent and sends both homes, dates and guest count', async () => {
    wrap(<ExchangeProposalForm requestedApartmentId="other-home" offeredId="mine" initialStart="2099-01-01" initialEnd="2099-01-05" />)
    expect(screen.getByRole('button', { name: 'Send exchange request' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Send exchange request' }))
    await waitFor(() => expect(dataClient.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/exchange/requests', data: { offeredApartmentId: 'mine', requestedApartmentId: 'other-home', start: '2099-01-01', end: '2099-01-05', guests: 1, note: '' } })))
    expect(await screen.findByText('Exchange request sent')).toBeInTheDocument()
  })
  it('acceptance includes the version reviewed and the receiving party guest count', async () => {
    wrap(<ExchangeRequestsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Accept exchange' }))
    await waitFor(() => expect(dataClient.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/exchange/requests/request/decision', data: { action: 'Accept', revision: 2, recipientGuests: 1 } })))
  })
  it('never offers self-acceptance or reviews for a pending outgoing request', async () => {
    vi.mocked(dataClient.get).mockResolvedValue({ data: [{ ...pending, requesterId: 'me', recipientId: 'other' }] })
    wrap(<ExchangeRequestsPage />)
    await screen.findByText('Outgoing request')
    expect(screen.queryByRole('button', { name: 'Accept exchange' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish review' })).not.toBeInTheDocument()
  })
  it('only completed exchanges expose the verified review form', async () => {
    vi.mocked(dataClient.get).mockResolvedValue({ data: [{ ...pending, status: 'Completed', end: '2020-01-01' }] })
    wrap(<ExchangeRequestsPage />)
    expect(await screen.findByRole('button', { name: 'Publish review' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept exchange' })).not.toBeInTheDocument()
  })
})
