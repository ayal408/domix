import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const source = 'https://accounts.google.com/gsi/client'
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); document.head.querySelectorAll(`script[src="${source}"]`).forEach(node => node.remove()); delete window.google })
afterEach(() => { vi.useRealTimers() })
it('removes a failed Google script so a retry can create a fresh request', async () => {
  const { loadGoogleIdentityScript } = await import('./googleIdentity')
  const initial = loadGoogleIdentityScript()
  const rejected = expect(initial).rejects.toThrow('GOOGLE_SCRIPT_LOAD_FAILED')
  document.querySelector(`script[src="${source}"]`)!.dispatchEvent(new Event('error'))
  await rejected
  expect(document.querySelector(`script[src="${source}"]`)).toBeNull()
  const retry = loadGoogleIdentityScript()
  const retryRejected = expect(retry).rejects.toThrow('GOOGLE_SCRIPT_TIMEOUT')
  expect(document.querySelector(`script[src="${source}"]`)).not.toBeNull()
  await vi.advanceTimersByTimeAsync(12_000)
  await retryRejected
})
it('deduplicates concurrent Google script loads and bounds blocked requests', async () => {
  const { loadGoogleIdentityScript } = await import('./googleIdentity')
  const first = loadGoogleIdentityScript()
  const second = loadGoogleIdentityScript()
  expect(first).toBe(second)
  expect(document.querySelectorAll(`script[src="${source}"]`)).toHaveLength(1)
  const rejected = expect(first).rejects.toThrow('GOOGLE_SCRIPT_TIMEOUT')
  await vi.advanceTimersByTimeAsync(12_000)
  await rejected
})
