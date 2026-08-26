import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StarRating, StarRatingInput } from '@/components/ui/StarRating'

describe('StarRating', () => {
  it('exposes the value via an accessible label', () => {
    render(<StarRating value={3.4} />)
    expect(screen.getByRole('img', { name: '3.4 out of 5 stars' })).toBeInTheDocument()
  })

  it('shows the count when provided', () => {
    render(<StarRating value={4} count={12} />)
    expect(screen.getByText('(12)')).toBeInTheDocument()
  })

  it('omits the count when not provided', () => {
    render(<StarRating value={4} />)
    expect(screen.queryByText(/^\(/)).not.toBeInTheDocument()
  })
})

describe('StarRatingInput', () => {
  it('renders one labelled button per star, 1 through 5', () => {
    render(<StarRatingInput onRate={vi.fn()} />)
    for (let score = 1; score <= 5; score++) {
      expect(screen.getByRole('button', { name: `Rate ${score} stars` })).toBeInTheDocument()
    }
  })

  it('calls onRate with the clicked score', async () => {
    const onRate = vi.fn()
    render(<StarRatingInput onRate={onRate} />)

    await userEvent.click(screen.getByRole('button', { name: 'Rate 4 stars' }))
    expect(onRate).toHaveBeenCalledWith(4)
    expect(onRate).toHaveBeenCalledTimes(1)
  })

  it('disables every star button when disabled', () => {
    render(<StarRatingInput onRate={vi.fn()} disabled />)
    for (let score = 1; score <= 5; score++) {
      expect(screen.getByRole('button', { name: `Rate ${score} stars` })).toBeDisabled()
    }
  })
})
