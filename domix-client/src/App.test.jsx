import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import App from './App'

describe('App', () => {
  test('renders the counter starting at 0', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Count is 0' })).toBeInTheDocument()
  })

  test('increments the counter on each click', async () => {
    const user = userEvent.setup()
    render(<App />)

    const button = screen.getByRole('button', { name: 'Count is 0' })
    await user.click(button)
    await user.click(button)

    expect(screen.getByRole('button', { name: 'Count is 2' })).toBeInTheDocument()
  })

  test('renders external links with target="_blank"', () => {
    render(<App />)

    const viteLink = screen.getByRole('link', { name: /Explore Vite/i })
    expect(viteLink).toHaveAttribute('href', 'https://vite.dev/')
    expect(viteLink).toHaveAttribute('target', '_blank')
  })
})
