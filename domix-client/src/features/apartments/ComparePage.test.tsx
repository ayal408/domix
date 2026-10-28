import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ComparePage from './ComparePage'
import { CompareButton } from './CompareButton'
import { CompareSelection } from './CompareSelection'
import { useCompareStore } from '@/stores/compare.store'
import { useToastStore } from '@/stores/toast.store'
import { ApiError } from '@/api/errors'
import * as api from '@/api/apartments.api'
import type { Apartment } from '@/types/api'
vi.mock('@/api/apartments.api')
const home = (id: string, price: number): Apartment => ({ apartmentId: id, userId: 'private-owner', isAnonymous: true,
  city: 'Haifa', area: 'Center', address: 'Hidden', status: 'Available', price, date: '2026-01-01T00:00:00Z', dateInsert: '2026-01-01T00:00:00Z',
  sumOfRooms: 3, floor: 0, elevator: false, parking: null, rating: 0, ratingCount: 0, listingType: 'Rent', availableFrom: '2026-12-01' })
function mount(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { vi.clearAllMocks(); useCompareStore.getState().clear() })
describe('comparison journey', () => {
  it('fetches only selected details, preserves zero/false/unknown values and filters identical rows', async () => {
    vi.mocked(api.getApartment).mockImplementation(async id => home(id, id === 'a' ? 4000 : 5000))
    useCompareStore.setState({ apartmentIds: ['a', 'b'] })
    mount(<ComparePage />)
    expect(await screen.findByText('₪4,000 per month')).toBeInTheDocument()
    expect(api.getApartment).toHaveBeenCalledTimes(2)
    expect(api.getAllApartments).not.toHaveBeenCalled()
    const floor = screen.getByRole('rowheader', { name: 'Floor' }).closest('tr')!
    expect(within(floor).getAllByRole('cell').map(c => c.textContent)).toEqual(['0', '0'])
    const elevator = screen.getByRole('rowheader', { name: 'Elevator' }).closest('tr')!
    expect(within(elevator).getAllByRole('cell').map(c => c.textContent)).toEqual(['No', 'No'])
    const parking = screen.getByRole('rowheader', { name: 'Parking' }).closest('tr')!
    expect(within(parking).getAllByRole('cell').map(c => c.textContent)).toEqual(['Not provided', 'Not provided'])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show differences only' }))
    expect(screen.queryByRole('rowheader', { name: 'Floor' })).not.toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Price' })).toBeInTheDocument()
    expect(screen.queryByText('private-owner')).not.toBeInTheDocument()
  })
  it('keeps healthy columns when another listing disappears and can remove the missing selection', async () => {
    vi.mocked(api.getApartment).mockImplementation(async id => { if (id === 'b') throw new ApiError({ status: 404, message: 'gone' }); return home(id, 4000) })
    useCompareStore.setState({ apartmentIds: ['a', 'b'] })
    mount(<ComparePage />)
    expect(await screen.findByText('This listing is no longer available to view.')).toBeInTheDocument()
    expect(screen.getByText('₪4,000 per month')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove from comparison · Listing 2' }))
    expect(useCompareStore.getState().apartmentIds).toEqual(['a'])
  })
  it('offers retry for a network failure without treating it as a deleted listing', async () => {
    vi.mocked(api.getApartment).mockRejectedValueOnce(new ApiError({ status: 503, message: 'offline' })).mockResolvedValue(home('a', 4000))
    useCompareStore.setState({ apartmentIds: ['a'] }); mount(<ComparePage />)
    expect(await screen.findByText('Could not load this listing.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('₪4,000 per month')).toBeInTheDocument()
  })
  it('shows the selection action and refuses a fourth listing without dropping earlier choices', async () => {
    useCompareStore.setState({ apartmentIds: ['a', 'b', 'c'] })
    const push = vi.spyOn(useToastStore.getState(), 'push')
    mount(<><CompareSelection /><CompareButton apartmentId="d" /></>)
    expect(screen.getByRole('link', { name: 'Compare selected listings' })).toHaveAttribute('href', '/compare')
    await userEvent.click(screen.getByRole('button', { name: 'Add to comparison' }))
    expect(useCompareStore.getState().apartmentIds).toEqual(['a', 'b', 'c'])
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('3') }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Compare selected listings' })).not.toBeInTheDocument())
    push.mockRestore()
  })
})
