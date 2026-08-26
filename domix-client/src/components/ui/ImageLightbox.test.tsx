import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

const images = ['https://example.com/1.jpg', 'https://example.com/2.jpg', 'https://example.com/3.jpg']

describe('ImageLightbox', () => {
  it('renders the image at initialIndex and a position counter', () => {
    render(<ImageLightbox images={images} initialIndex={1} onClose={vi.fn()} />)
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    expect(document.querySelector('img')).toHaveAttribute('src', images[1])
  })

  it('advances to the next image on the next button and ArrowRight, wrapping past the last image', async () => {
    render(<ImageLightbox images={images} initialIndex={2} onClose={vi.fn()} />)
    expect(screen.getByText('3 / 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next image' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('goes to the previous image on ArrowLeft, wrapping before the first image', async () => {
    render(<ImageLightbox images={images} initialIndex={0} onClose={vi.fn()} />)
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<ImageLightbox images={images} initialIndex={0} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn()
    render(<ImageLightbox images={images} initialIndex={0} onClose={onClose} />)

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('omits navigation controls for a single image', () => {
    render(<ImageLightbox images={['https://example.com/1.jpg']} initialIndex={0} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument()
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument()
  })
})
