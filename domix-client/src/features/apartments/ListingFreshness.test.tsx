import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ListingFreshness } from './ListingFreshness'
import { confirmationState } from './availabilityConfirmation'
import type { Apartment } from '@/types/api'

describe('availability confirmation', () => {
  it('does not infer confirmation from missing, invalid or future dates', () => {
    const now = Date.parse('2026-10-28T10:00:00Z')
    for (const value of [null, undefined, '', 'invalid', '2026-10-29T10:00:00Z']) expect(confirmationState(value, now)).toBe('unconfirmed')
    expect(confirmationState('2026-10-28T09:00:00', now)).toBe('confirmed')
    expect(confirmationState('2026-09-28T10:00:00Z', now)).toBe('stale')
  })
  it('does not claim a closed listing is still available', () => {
    const client = new QueryClient()
    render(<QueryClientProvider client={client}><ListingFreshness apartment={{ status: 'Sold', lastConfirmedAt: new Date().toISOString() } as Apartment} detailed /></QueryClientProvider>)
    expect(screen.queryByText(/Availability confirmed/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
