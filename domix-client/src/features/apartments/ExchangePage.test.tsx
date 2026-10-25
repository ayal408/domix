import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ExchangePage from './ExchangePage'
import { validExchangeDates } from './exchangeDates'
import { useAuthStore } from '@/stores/auth.store'
import { dataClient } from '@/api/http'

const { list } = vi.hoisted(() => ({ list: { data: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() } }))
vi.mock('@/hooks/useApartments', () => ({ useApartments: () => list }))
vi.mock('@/hooks/useFavorites', () => ({ useFavoriteIds: () => ({ ids: new Set() }), useToggleFavorite: () => ({ mutate: vi.fn() }) }))
vi.mock('@/components/ui/HebrewDateField', () => ({ HebrewDateField: ({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (s: string) => void }) => <label>{label}<input type="date" name={name} value={value} onChange={e => onChange(e.target.value)} /></label> }))
const offer = { apartmentId: 'offer', userId: 'me', city: 'Haifa', address: '1 Main', listingType: 'Exchange', status: 'Available', desiredCity: 'Jerusalem', availableFrom: '2099-01-01', availableTo: '2099-01-10' }
const candidate = { ...offer, apartmentId: 'match', userId: 'other', city: 'Jerusalem', price: 0, area: 'Center', ratingCount: 0 }
function page(initial = '/exchange?offeredApartmentId=offer&destination=Jerusalem&start=2099-01-02&end=2099-01-05') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[initial]}><ExchangePage /></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  vi.restoreAllMocks()
  list.data = [offer]
  useAuthStore.setState({ status: 'authenticated', user: { userId: 'me' } as never })
  vi.spyOn(dataClient, 'get').mockResolvedValue({ data: [{ apartment: candidate, isMutual: true }] })
})

describe('automatic exchange suggestions', () => {
  it('requests matches automatically and keeps the offered home and dates in the listing link', async () => {
    page()
    const link = await screen.findByRole('link', { name: 'Jerusalem, 1 Main' })
    expect(link.getAttribute('href')).toContain('offeredApartmentId=offer')
    expect(link.getAttribute('href')).toContain('start=2099-01-02')
    expect(dataClient.get).toHaveBeenCalledWith('/exchange/matches', expect.objectContaining({ params: { offeredApartmentId: 'offer', destination: 'Jerusalem', start: '2099-01-02', end: '2099-01-05' } }))
    expect(screen.getByText('Mutual match: looking in your home city')).toBeInTheDocument()
  })
  it('fills the request from the selected home and updates suggestions without a submit button', async () => {
    page('/exchange')
    expect(dataClient.get).not.toHaveBeenCalled()
    await userEvent.selectOptions(screen.getByLabelText('My offered home'), 'offer')
    await waitFor(() => expect(dataClient.get).toHaveBeenCalled(), { timeout: 2000 })
    expect(screen.getByLabelText('Desired city')).toHaveValue('Jerusalem')
    expect(screen.getByLabelText('Check-in date')).toHaveValue('2099-01-01')
  })
  it('asks the server about additional calendar windows beyond base availability', async () => {
    page('/exchange?offeredApartmentId=offer&destination=Jerusalem&start=2099-01-02&end=2099-01-20')
    await waitFor(() => expect(dataClient.get).toHaveBeenCalledWith('/exchange/matches', expect.objectContaining({ params: expect.objectContaining({ end: '2099-01-20' }) })))
  })
  it('offers publishing when the user has no exchange home', () => {
    list.data = []
    page('/exchange')
    expect(screen.getByRole('link', { name: 'Publish my home' })).toHaveAttribute('href', '/my-apartments')
    expect(dataClient.get).not.toHaveBeenCalled()
  })
})

describe('calendar-only exchange date validation', () => {
  it('rejects reverse, zero-night, past and impossible dates', () => {
    expect(validExchangeDates('2099-01-04', '2099-01-02', '2099-01-01')).toBe(false)
    expect(validExchangeDates('2099-01-04', '2099-01-04', '2099-01-01')).toBe(false)
    expect(validExchangeDates('2098-12-31', '2099-01-04', '2099-01-01')).toBe(false)
    expect(validExchangeDates('2099-02-30', '2099-03-04', '2099-01-01')).toBe(false)
    expect(validExchangeDates('2099-01-01', '2099-01-02', '2099-01-01')).toBe(true)
  })
})
