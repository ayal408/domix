import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminDashboardPage from './AdminDashboardPage'
import { useAnalyticsSummary } from '@/hooks/useAnalytics'
import { useAuthStore } from '@/stores/auth.store'
import type { AnalyticsSummary, UserResponse } from '@/types/api'
vi.mock('@/hooks/useAnalytics',()=>({useAnalyticsSummary:vi.fn()}))
const user: UserResponse={userId:'staff',userName:'Staff',role:'Manager',registrationMethod:'Password',joiningDate:'2026-01-01',isEmailVerified:true,isBlocked:false}
const refresh=vi.fn()
beforeEach(()=>{vi.clearAllMocks();useAuthStore.setState({status:'authenticated',user})})
function data(state:Record<string,unknown>){vi.mocked(useAnalyticsSummary).mockReturnValue({isLoading:false,isError:false,isFetching:false,dataUpdatedAt:Date.now(),refetch:refresh,...state} as unknown as ReturnType<typeof useAnalyticsSummary>)}
function mount(){render(<MemoryRouter><AdminDashboardPage/></MemoryRouter>)}
it('displays server counts and limits management quick actions by role',()=>{
  data({data:{availableApartments:12,totalUsers:28,openSupportTickets:3,newApartmentsLast7Days:6} as AnalyticsSummary});mount()
  expect(screen.getByText('28')).toBeInTheDocument()
  expect(screen.queryByRole('link',{name:'User accounts'})).not.toBeInTheDocument()
  expect(screen.queryByRole('link',{name:'Email connection'})).not.toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Registered accounts 28'})).toHaveAttribute('href','/admin/analytics')
})
it('offers retry for a summary failure without displaying invented zero counts',async()=>{
  data({isError:true,data:undefined});mount()
  expect(screen.getByText('Could not load the management summary.')).toBeInTheDocument()
  expect(screen.queryByText('0')).not.toBeInTheDocument()
  await userEvent.click(screen.getAllByRole('button',{name:'Refresh summary'})[0]!)
  expect(refresh).toHaveBeenCalled()
})
