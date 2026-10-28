import { beforeEach, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AdminNavigation } from './AdminNavigation'
import { useAuthStore } from '@/stores/auth.store'
import type { Role, UserResponse } from '@/types/api'
const user: UserResponse={userId:'staff',userName:'Staff',role:'Admin',registrationMethod:'Password',joiningDate:'2026-01-01',isEmailVerified:true,isBlocked:false}
beforeEach(()=>useAuthStore.setState({status:'authenticated',user}))
function mount(role:Role='Admin',mini=false){useAuthStore.setState({user:{...user,role}});return render(<MemoryRouter initialEntries={['/admin/reports']}><AdminNavigation idPrefix="test-admin" mini={mini}/></MemoryRouter>)}
it('limits manager navigation and selects only the current screen',()=>{
  mount('Manager')
  expect(screen.queryByRole('link',{name:'User accounts'})).not.toBeInTheDocument()
  expect(screen.queryByRole('link',{name:'Email connection'})).not.toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Review reports'})).toHaveAttribute('aria-current','page')
  expect(screen.getByRole('link',{name:'Overview'})).not.toHaveAttribute('aria-current')
})
it('finds permitted screens through collapsed groups and shows an empty search result truthfully',async()=>{
  mount();await userEvent.click(screen.getByRole('button',{name:'System'}))
  expect(screen.queryByRole('link',{name:'Email connection'})).not.toBeInTheDocument()
  await userEvent.type(screen.getByRole('searchbox',{name:'Find a management screen'}),'email')
  expect(screen.getByRole('link',{name:'Email connection'})).toBeInTheDocument()
  expect(screen.queryByRole('link',{name:'Manage listings'})).not.toBeInTheDocument()
  await userEvent.clear(screen.getByRole('searchbox'));await userEvent.type(screen.getByRole('searchbox'),'no-such-page')
  expect(screen.getByRole('status')).toHaveTextContent('No screens match this search.')
})
it('keeps icon-only navigation named and does not expose admin links to a manager',()=>{
  mount('Manager',true)
  expect(screen.getByRole('link',{name:'Manage listings'})).toHaveAttribute('title','Manage listings')
  expect(screen.queryByRole('link',{name:'User accounts'})).not.toBeInTheDocument()
})
