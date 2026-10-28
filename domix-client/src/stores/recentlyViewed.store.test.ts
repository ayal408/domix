import { beforeEach, describe, expect, it } from 'vitest'
import { useRecentlyViewedStore, MAX_RECENTLY_VIEWED } from './recentlyViewed.store'
import { useAuthStore } from './auth.store'
import type { UserResponse } from '@/types/api'
const user: UserResponse = {userId:'viewer',userName:'Viewer',role:'User',registrationMethod:'Password',joiningDate:'2026-01-01',isEmailVerified:true,isBlocked:false}
beforeEach(() => { useAuthStore.setState({status:'authenticated',user});useRecentlyViewedStore.getState().clear() })
describe('private recently viewed list', () => {
  it('deduplicates, puts the latest view first and caps memory at eight ids', () => {
    const store = useRecentlyViewedStore.getState()
    for (let i=0;i<MAX_RECENTLY_VIEWED+2;i++) store.record('viewer',`home-${i}`)
    store.record('viewer','home-5')
    expect(useRecentlyViewedStore.getState().apartmentIds).toHaveLength(8)
    expect(useRecentlyViewedStore.getState().apartmentIds[0]).toBe('home-5')
    expect(new Set(useRecentlyViewedStore.getState().apartmentIds).size).toBe(8)
    expect(useRecentlyViewedStore.getState().apartmentIds).not.toContain('home-0')
  })
  it('replaces rather than shares another account’s history', () => {
    useRecentlyViewedStore.getState().record('viewer','private-one')
    useRecentlyViewedStore.getState().record('other','private-two')
    expect(useRecentlyViewedStore.getState().apartmentIds).toEqual(['private-two'])
  })
  it('clears on account change and session expiry', () => {
    useRecentlyViewedStore.getState().record('viewer','private-one')
    useAuthStore.setState({user:{...user,userId:'other'}})
    expect(useRecentlyViewedStore.getState().apartmentIds).toEqual([])
    useRecentlyViewedStore.getState().record('other','private-two')
    useAuthStore.setState({status:'unauthenticated',user:null})
    expect(useRecentlyViewedStore.getState().apartmentIds).toEqual([])
    expect(useRecentlyViewedStore.getState().ownerId).toBeNull()
  })
})
