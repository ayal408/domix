import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ComponentProps } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/stores/auth.store'
import type { UserResponse } from '@/types/api'

const managerUser: UserResponse = {
  userId: 'u1',
  userName: 'manager',
  registrationMethod: 'Password',
  role: 'Manager',
  joiningDate: '2024-01-01T00:00:00Z',
  isEmailVerified: true,
  isBlocked: false,
}

function renderProtected(props: Partial<ComponentProps<typeof ProtectedRoute>> = {}) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/unauthorized" element={<div>Unauthorized page</div>} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute {...props}>
              <div>Secret content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ status: 'initializing', user: null })
})

describe('ProtectedRoute', () => {
  it('renders nothing while the session is still being restored', () => {
    const { container } = renderProtected()
    expect(container).toBeEmptyDOMElement()
  })

  it('redirects to /login when signed out', () => {
    useAuthStore.setState({ status: 'unauthenticated', user: null })
    renderProtected()
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('renders the protected content when signed in with no policy required', () => {
    useAuthStore.setState({ status: 'authenticated', user: managerUser })
    renderProtected()
    expect(screen.getByText('Secret content')).toBeInTheDocument()
  })

  it('redirects to /unauthorized when signed in but the policy is not satisfied', () => {
    useAuthStore.setState({ status: 'authenticated', user: managerUser })
    renderProtected({ policy: 'AdminOnly' })
    expect(screen.getByText('Unauthorized page')).toBeInTheDocument()
  })

  it('renders the protected content when the policy is satisfied', () => {
    useAuthStore.setState({ status: 'authenticated', user: managerUser })
    renderProtected({ policy: 'ManagerOrAdmin' })
    expect(screen.getByText('Secret content')).toBeInTheDocument()
  })

  it('supports gating by an explicit role list instead of a policy', () => {
    useAuthStore.setState({ status: 'authenticated', user: managerUser })
    renderProtected({ roles: ['Admin'] })
    expect(screen.getByText('Unauthorized page')).toBeInTheDocument()
  })
})
