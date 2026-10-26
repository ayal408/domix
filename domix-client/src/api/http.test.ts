import axios, { AxiosError, type AxiosAdapter } from 'axios'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { clearAccessToken, setAccessToken } from '@/api/tokenStore'
vi.mock('@/api/tokenStore', () => ({ clearAccessToken: vi.fn(), setAccessToken: vi.fn(), getAccessToken: () => 'token', isAccessTokenExpired: () => false }))
const originalAdapter = axios.defaults.adapter
beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })
afterEach(() => { axios.defaults.adapter = originalAdapter })
function rejectStatus(status: number): AxiosAdapter {
  return async config => { throw new AxiosError('failure', 'ERR_BAD_RESPONSE', config, undefined, { data: {}, status, statusText: 'failure', headers: {}, config }) }
}
it('does not clear a session on a temporary refresh failure', async () => {
  axios.defaults.adapter = rejectStatus(503)
  const http = await import('./http')
  const expired = vi.fn()
  http.setSessionExpiredHandler(expired)
  await expect(http.refreshAccessToken()).rejects.toMatchObject({ status: 503 })
  expect(clearAccessToken).not.toHaveBeenCalled()
  expect(expired).not.toHaveBeenCalled()
})
it('clears only a definitively invalid refresh session', async () => {
  axios.defaults.adapter = rejectStatus(401)
  const http = await import('./http')
  const expired = vi.fn()
  http.setSessionExpiredHandler(expired)
  await expect(http.refreshAccessToken()).resolves.toBeNull()
  expect(clearAccessToken).toHaveBeenCalledTimes(1)
  expect(expired).toHaveBeenCalledTimes(1)
})
it('shares one refresh across concurrent callers', async () => {
  const adapter = vi.fn<AxiosAdapter>().mockImplementation(async config => ({ data: { accessToken: 'new-token' }, status: 200, statusText: 'OK', headers: {}, config }))
  axios.defaults.adapter = adapter
  const http = await import('./http')
  await Promise.all([http.refreshAccessToken(), http.refreshAccessToken(), http.refreshAccessToken()])
  expect(adapter).toHaveBeenCalledTimes(1)
  expect(setAccessToken).toHaveBeenCalledWith('new-token')
})
it('a data request does not expire the session when refresh returns 503', async () => {
  axios.defaults.adapter = async config => rejectStatus(config.url?.includes('refresh') ? 503 : 401)(config)
  const http = await import('./http')
  const expired = vi.fn()
  http.setSessionExpiredHandler(expired)
  await expect(http.dataClient.get('/protected')).rejects.toMatchObject({ status: 503 })
  expect(expired).not.toHaveBeenCalled()
  expect(clearAccessToken).not.toHaveBeenCalled()
})
