import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Suspense } from 'react'
import { lazyWithReload, withChunkReload } from '@/lib/lazyWithReload'

const RELOAD_FLAG = 'domix.chunk-reload-attempted'

beforeEach(() => {
  sessionStorage.clear()
})

describe('withChunkReload', () => {
  it('resolves through unchanged on success and clears a stale reload flag', async () => {
    sessionStorage.setItem(RELOAD_FLAG, '1')
    const wrapped = withChunkReload(() => Promise.resolve({ value: 'ok' }))

    await expect(wrapped()).resolves.toEqual({ value: 'ok' })
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBeNull()
  })

  it('reloads exactly once on a chunk-load failure and never settles', async () => {
    const reload = vi.fn()
    const wrapped = withChunkReload(
      () => Promise.reject(new Error('Failed to fetch dynamically imported module')),
      reload,
    )

    let settled = false
    void wrapped().finally(() => {
      settled = true
    })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBe('1')
    expect(settled).toBe(false)
  })

  it('does not reload again once the flag from a prior attempt is set, and rejects instead', async () => {
    sessionStorage.setItem(RELOAD_FLAG, '1')
    const reload = vi.fn()
    const wrapped = withChunkReload(
      () => Promise.reject(new Error('Failed to fetch dynamically imported module')),
      reload,
    )

    await expect(wrapped()).rejects.toThrow('Failed to fetch dynamically imported module')
    expect(reload).not.toHaveBeenCalled()
  })

  it('rethrows a non-chunk error without reloading', async () => {
    const reload = vi.fn()
    const wrapped = withChunkReload(() => Promise.reject(new Error('some other runtime error')), reload)

    await expect(wrapped()).rejects.toThrow('some other runtime error')
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('lazyWithReload', () => {
  function Ok() {
    return <div>loaded</div>
  }

  it('renders normally through Suspense when the import succeeds', async () => {
    const Lazy = lazyWithReload(() => Promise.resolve({ default: Ok }))
    render(
      <Suspense fallback="loading">
        <Lazy />
      </Suspense>,
    )
    await waitFor(() => expect(screen.getByText('loaded')).toBeInTheDocument())
  })
})
