import { useRecentlyViewedStore } from '@/stores/recentlyViewed.store'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/api/queryClient'
import { useAuthStore } from '@/stores/auth.store'
import { useChatWidgetStore } from '@/stores/chatWidget.store'
import { useCompareStore } from '@/stores/compare.store'
import { FloatingChatWidget } from '@/components/chat/FloatingChatWidget'
import { OwnerProfileCard } from '@/features/apartments/OwnerProfileCard'
import { dataClient } from '@/api/http'
import * as support from '@/api/support.api'
import type { UserResponse } from '@/types/api'
import '@/features/privacy/privacy.i18n'
import i18n from '@/i18n'

vi.mock('@/api/support.api')
const user: UserResponse = { userId: 'owner', userName: 'Owner', role: 'User', registrationMethod: 'Password', joiningDate: '2026-01-01', isEmailVerified: true, isBlocked: false }
function wrap(child: React.ReactNode) { return render(<QueryClientProvider client={queryClient}><MemoryRouter>{child}</MemoryRouter></QueryClientProvider>) }
beforeEach(async () => {
  vi.restoreAllMocks()
  Element.prototype.scrollTo = vi.fn()
  await i18n.changeLanguage('he')
  useAuthStore.setState({ status: 'authenticated', user })
  useChatWidgetStore.getState().reset()
  queryClient.clear()
  vi.spyOn(dataClient, 'get').mockResolvedValue({ data: { enabled: true } })
  vi.mocked(support.createSupportTicket).mockClear().mockResolvedValue({ supportTicketId: 'ticket' } as never)
})

describe('privacy boundaries', () => {
  it('clears conversation, comparison and cached private data on identity change', () => {
    useChatWidgetStore.getState().addMessage('user', 'Private chat')
    useCompareStore.getState().toggle('private-listing')
    useRecentlyViewedStore.getState().record(user.userId, 'private-listing')
    queryClient.setQueryData(['private-inbox'], ['Secret'])
    useAuthStore.setState({ user: { ...user, userId: 'other' } })
    expect(useChatWidgetStore.getState().messages).toEqual([])
    expect(useCompareStore.getState().apartmentIds).toEqual([])
    expect(useRecentlyViewedStore.getState().apartmentIds).toEqual([])
    expect(queryClient.getQueryData(['private-inbox'])).toBeUndefined()
  })
  it('never fetches hidden contact information for an anonymous listing', () => {
    wrap(<OwnerProfileCard ownerId="00000000-0000-0000-0000-000000000000" currentApartmentId="listing" isAnonymous />)
    expect(screen.getByText(i18n.t('apartments.detail.privateOwner'))).toBeInTheDocument()
    expect(vi.mocked(dataClient.get).mock.calls.every(([url]) => !url?.includes('listing-contact') && !url?.includes('by-id'))).toBe(true)
  })
  it('requires the adult/privacy choice before enabling model input', async () => {
    useChatWidgetStore.getState().toggle()
    wrap(<FloatingChatWidget />)
    const choice = await screen.findByLabelText(i18n.t('privacy:chatAccept'))
    expect(screen.getByPlaceholderText(i18n.t('chat.inputPlaceholder'))).toBeDisabled()
    await userEvent.click(choice)
    expect(screen.getByPlaceholderText(i18n.t('chat.inputPlaceholder'))).toBeEnabled()
  })
  it('submits support without history by default', async () => {
    useChatWidgetStore.getState().addMessage('user', 'Secret history')
    useChatWidgetStore.getState().toggle()
    wrap(<FloatingChatWidget />)
    await userEvent.click(screen.getByText(i18n.t('chat.contactTeam.trigger')))
    await userEvent.type(screen.getByRole('textbox'), 'Please help')
    await userEvent.click(screen.getByRole('button', { name: i18n.t('chat.contactTeam.send') }))
    await waitFor(() => expect(support.createSupportTicket).toHaveBeenCalled())
    expect(vi.mocked(support.createSupportTicket).mock.calls[0]?.[0]).toMatchObject({ includeTranscript: false, transcript: undefined })
  })
  it('lets the user edit the optional transcript', async () => {
    useChatWidgetStore.getState().addMessage('user', 'Secret history')
    useChatWidgetStore.getState().toggle()
    wrap(<FloatingChatWidget />)
    await userEvent.click(screen.getByText(i18n.t('chat.contactTeam.trigger')))
    await userEvent.type(screen.getByRole('textbox'), 'Please help')
    await userEvent.click(screen.getByLabelText(i18n.t('privacy:includeTranscript')))
    const preview = screen.getByLabelText(i18n.t('privacy:transcriptPreview'))
    await userEvent.clear(preview); await userEvent.type(preview, 'Only the relevant part')
    await userEvent.click(screen.getByRole('button', { name: i18n.t('chat.contactTeam.send') }))
    await waitFor(() => expect(support.createSupportTicket).toHaveBeenCalled())
    expect(vi.mocked(support.createSupportTicket).mock.calls.at(-1)?.[0]).toMatchObject({ includeTranscript: true, transcript: [{ role: 'user', text: 'Only the relevant part' }] })
  })
})
