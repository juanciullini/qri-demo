import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivateRoute from '@/components/PrivateRoute'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types'

const adminUser: User = {
  id: 'u1',
  email: 'admin@qri.app',
  name: 'Admin',
  role: 'ADMIN',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const viewerUser: User = {
  ...adminUser,
  id: 'u2',
  role: 'VIEWER',
}

function renderWithRouter(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  })
})

describe('PrivateRoute', () => {
  it('shows loading spinner when isLoading is true', () => {
    useAuthStore.setState({ isLoading: true })

    renderWithRouter(
      <PrivateRoute>
        <div>Protected Content</div>
      </PrivateRoute>,
    )

    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('redirects to /login when not authenticated', () => {
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: false,
    })

    renderWithRouter(
      <PrivateRoute>
        <div>Protected Content</div>
      </PrivateRoute>,
    )

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated without role restriction', () => {
    useAuthStore.setState({
      user: adminUser,
      isAuthenticated: true,
      isLoading: false,
    })

    renderWithRouter(
      <PrivateRoute>
        <div>Protected Content</div>
      </PrivateRoute>,
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('renders children when user has an allowed role', () => {
    useAuthStore.setState({
      user: adminUser,
      isAuthenticated: true,
      isLoading: false,
    })

    renderWithRouter(
      <PrivateRoute roles={['ADMIN', 'OPERATOR']}>
        <div>Admin Content</div>
      </PrivateRoute>,
    )

    expect(screen.getByText('Admin Content')).toBeInTheDocument()
  })

  it('redirects when user role is not in allowed roles', () => {
    useAuthStore.setState({
      user: viewerUser,
      isAuthenticated: true,
      isLoading: false,
    })

    renderWithRouter(
      <PrivateRoute roles={['ADMIN', 'OPERATOR']}>
        <div>Admin Only</div>
      </PrivateRoute>,
    )

    expect(screen.queryByText('Admin Only')).not.toBeInTheDocument()
  })
})
