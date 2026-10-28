import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RecentlyViewedPage from './RecentlyViewedPage'
import { useRecentlyViewedStore } from '@/stores/recentlyViewed.store'
import { useAuthStore } from '@/stores/auth.store'
import * as api from '@/api/apartments.api'
import * as favorites from '@/api/favorites.api'
import { ApiError } from '@/api/errors'
import type { Apartment, UserResponse } from '@/types/api'
vi.mock('@/api/apartments.api')
vi.mock('@/api/favorites.api')
const user: UserResponse={userId:'viewer',userName:'Viewer',role:'User',registrationMethod:'Password',joiningDate:'2026-01-01',isEmailVerified:true,isBlocked:false}
const home: Apartment={apartmentId:'available',userId:'00000000-0000-0000-0000-000000000000',city:'Haifa',area:'Carmel',address:'Carmel',isAnonymous:true,price:4200,status:'Available',date:'2026-10-01',dateInsert:'2026-10-01',rating:0,ratingCount:0,listingType:'Rent'}
function mount(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><RecentlyViewedPage/></MemoryRouter></QueryClientProvider>)}
beforeEach(()=>{vi.clearAllMocks();useAuthStore.setState({status:'authenticated',user});useRecentlyViewedStore.getState().clear();vi.mocked(favorites.getFavorites).mockResolvedValue([])})
it('fetches only history entries, keeps healthy listings when another disappears and allows removal',async()=>{
  useRecentlyViewedStore.getState().record('viewer','available');useRecentlyViewedStore.getState().record('viewer','gone')
  vi.mocked(api.getApartment).mockImplementation(async id=>{if(id==='gone')throw new ApiError({status:404,message:'gone'});return home})
  mount();expect(await screen.findByText('This listing is no longer available to view.')).toBeInTheDocument()
  expect(await screen.findByText('Haifa · Carmel')).toBeInTheDocument();expect(api.getApartment).toHaveBeenCalledTimes(2);expect(api.getAllApartments).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button',{name:'Remove from history · 1'}));expect(useRecentlyViewedStore.getState().apartmentIds).toEqual(['available'])
  await userEvent.click(screen.getByRole('button',{name:'Clear viewing history'}));expect(screen.getByText('No recently viewed homes')).toBeInTheDocument()
})
it('does not read history owned by another account',()=>{
  useRecentlyViewedStore.getState().record('other','private-home');mount()
  expect(api.getApartment).not.toHaveBeenCalled();expect(screen.getByText('No recently viewed homes')).toBeInTheDocument()
})
