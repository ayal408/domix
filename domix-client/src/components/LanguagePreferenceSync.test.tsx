import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { act } from 'react'
import { dataClient } from '@/api/http'
import type * as HttpApi from '@/api/http'
import { useAuthStore } from '@/stores/auth.store'
import i18n from '@/i18n'
import { LanguagePreferenceSync } from './LanguagePreferenceSync'

vi.mock('@/api/http', async (original) => {
  const actual = await original<typeof HttpApi>()
  return { ...actual, dataClient: { ...actual.dataClient, put: vi.fn().mockResolvedValue({}) } }
})
beforeEach(async () => {
  vi.mocked(dataClient.put).mockClear()
  useAuthStore.setState({ status: 'unauthenticated', user: null })
  await i18n.changeLanguage('he')
})
describe('Email language preference', () => {
  it('uses Hebrew when no language has been selected and avoids anonymous writes', () => {
    expect(i18n.options.fallbackLng).toEqual(['he'])
    expect(i18n.options.detection?.order).toEqual(['localStorage'])
    render(<LanguagePreferenceSync />)
    expect(dataClient.put).not.toHaveBeenCalled()
  })
  it('persists the interface language for the signed-in user and follows changes', async () => {
    useAuthStore.setState({ status: 'authenticated', user: {
      userId: 'user-1', userName: 'User', registrationMethod: 'Password', role: 'User',
      joiningDate: '2026-10-06T00:00:00Z', isEmailVerified: true, isBlocked: false,
    } })
    render(<LanguagePreferenceSync />)
    await waitFor(() => expect(dataClient.put).toHaveBeenCalledWith('/preferences/language', { language: 'he' }, expect.any(Object)))
    await act(async () => { await i18n.changeLanguage('fr') })
    await waitFor(() => expect(dataClient.put).toHaveBeenLastCalledWith('/preferences/language', { language: 'fr' }, expect.any(Object)))
  })
})
