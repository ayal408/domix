import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApartmentCard } from '@/features/apartments/ApartmentCard'
import { useAuthStore } from '@/stores/auth.store'
import { useCompareStore } from '@/stores/compare.store'
import * as favoritesApi from '@/api/favorites.api'
import type { Apartment, UserResponse } from '@/types/api'

vi.mock('@/api/favorites.api')

const testUser: UserResponse = {
  userId: 'u1',
  userName: 'tester',
  registrationMethod: 'Password',
  role: 'User',
  joiningDate: '2024-01-01T00:00:00Z',
  isEmailVerified: true,
  isBlocked: false,
}

const apartment: Apartment = {
  apartmentId: 'a1',
  userId: 'owner-1',
  status: 'Available',
  isAnonymous: false,
  price: 5000,
  date: '2024-01-01T00:00:00Z',
  city: 'Tel Aviv',
  area: 'Center',
  address: 'Dizengoff 1',
  dateInsert: '2024-01-01T00:00:00Z',
  rating: 0,
  ratingCount: 0,
}

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ApartmentCard apartment={apartment} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(favoritesApi.getFavorites).mockResolvedValue([])
  vi.mocked(favoritesApi.addFavorite).mockResolvedValue({ favoriteId: 'f1', apartmentId: 'a1', createdAt: '2024-01-01T00:00:00Z' })
  vi.mocked(favoritesApi.removeFavorite).mockResolvedValue(undefined)
  useAuthStore.setState({ status: 'unauthenticated', user: null })
  useCompareStore.setState({ apartmentIds: [] })
})

describe('ApartmentCard', () => {
  it('hides the favorite toggle for anonymous visitors', () => {
    renderCard()
    expect(screen.queryByRole('button', { name: 'Add to favorites' })).not.toBeInTheDocument()
  })

  it('shows the favorite toggle when signed in and calls the add-favorite API on click', async () => {
    useAuthStore.setState({ status: 'authenticated', user: testUser })
    renderCard()

    const button = screen.getByRole('button', { name: 'Add to favorites' })
    await userEvent.click(button)

    await waitFor(() => expect(favoritesApi.addFavorite).toHaveBeenCalledWith('a1'))
  })

  it('toggles the apartment into the compare store when the compare button is clicked', async () => {
    renderCard()

    await userEvent.click(screen.getByRole('button', { name: /Compare/ }))
    expect(useCompareStore.getState().isSelected('a1')).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: /Compare/ }))
    expect(useCompareStore.getState().isSelected('a1')).toBe(false)
  })
})
