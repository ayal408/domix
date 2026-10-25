import { describe, expect, it } from 'vitest'
import { authReturn } from './authReturn'
describe('auth return', () => {
  it('preserves the destination and dates after either auth flow', () => {
    expect(authReturn({ from: { pathname: '/exchange', search: '?destination=Jerusalem&start=2099-01-02' } })).toBe('/exchange?destination=Jerusalem&start=2099-01-02')
  })
  it('rejects external paths, backslashes and auth loops', () => {
    for (const pathname of ['//evil.example', 'https://evil.example', '/\\evil.example', '/login', '/register']) expect(authReturn({ from: { pathname } })).toBe('/')
    expect(authReturn(null)).toBe('/')
  })
})
