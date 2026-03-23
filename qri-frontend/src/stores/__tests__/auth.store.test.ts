import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types'

vi.mock('@/services/auth.service', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  getMe: vi.fn(),
}))

import * as authService from '@/services/auth.service'

const mockedAuthService = vi.mocked(authService)

const mockUser: User = {
  id: 'u1',
  email: 'admin@qri.app',
  name: 'Admin',
  role: 'ADMIN',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()

  // Reset Zustand store to initial state
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  })
})

describe('auth store - initial state', () => {
  it('has correct initial state', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(true)
  })
})

describe('auth store - login', () => {
  it('stores tokens in localStorage and updates state', async () => {
    mockedAuthService.login.mockResolvedValue({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      user: mockUser,
    })

    await useAuthStore.getState().login('admin@qri.app', 'password')

    expect(mockedAuthService.login).toHaveBeenCalledWith(
      'admin@qri.app',
      'password',
    )
    expect(localStorage.getItem('access_token')).toBe('access-123')
    expect(localStorage.getItem('refresh_token')).toBe('refresh-456')

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
  })

  it('propagates API errors', async () => {
    mockedAuthService.login.mockRejectedValue(new Error('Invalid credentials'))

    await expect(
      useAuthStore.getState().login('bad@test.com', 'wrong'),
    ).rejects.toThrow('Invalid credentials')

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})

describe('auth store - logout', () => {
  it('calls API logout and clears state', async () => {
    // Set up authenticated state
    localStorage.setItem('access_token', 'access-123')
    localStorage.setItem('refresh_token', 'refresh-456')
    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true,
    })
    mockedAuthService.logout.mockResolvedValue(undefined)

    await useAuthStore.getState().logout()

    expect(mockedAuthService.logout).toHaveBeenCalledWith('refresh-456')
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('clears state even if API logout fails', async () => {
    localStorage.setItem('access_token', 'access-123')
    localStorage.setItem('refresh_token', 'refresh-456')
    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true,
    })
    mockedAuthService.logout.mockRejectedValue(new Error('Network error'))

    await useAuthStore.getState().logout()

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('skips API call when no refresh token exists', async () => {
    await useAuthStore.getState().logout()

    expect(mockedAuthService.logout).not.toHaveBeenCalled()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})

describe('auth store - refreshAuth', () => {
  it('refreshes tokens and re-fetches user', async () => {
    localStorage.setItem('refresh_token', 'old-refresh')
    mockedAuthService.refresh.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
    })
    mockedAuthService.getMe.mockResolvedValue(mockUser)

    await useAuthStore.getState().refreshAuth()

    expect(mockedAuthService.refresh).toHaveBeenCalledWith('old-refresh')
    expect(localStorage.getItem('access_token')).toBe('new-access')
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh')
    expect(mockedAuthService.getMe).toHaveBeenCalled()

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
  })

  it('clears everything when no refresh token exists', async () => {
    await useAuthStore.getState().refreshAuth()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(mockedAuthService.refresh).not.toHaveBeenCalled()
  })

  it('clears everything when refresh fails', async () => {
    localStorage.setItem('access_token', 'old-access')
    localStorage.setItem('refresh_token', 'old-refresh')
    useAuthStore.setState({ user: mockUser, isAuthenticated: true })
    mockedAuthService.refresh.mockRejectedValue(new Error('Token expired'))

    await useAuthStore.getState().refreshAuth()

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})

describe('auth store - initialize', () => {
  it('fetches user when access token exists', async () => {
    localStorage.setItem('access_token', 'valid-token')
    mockedAuthService.getMe.mockResolvedValue(mockUser)

    await useAuthStore.getState().initialize()

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
  })

  it('sets isLoading=false with no token', async () => {
    await useAuthStore.getState().initialize()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('tries refresh when getMe fails, then succeeds', async () => {
    localStorage.setItem('access_token', 'expired-token')
    localStorage.setItem('refresh_token', 'valid-refresh')

    mockedAuthService.getMe
      .mockRejectedValueOnce(new Error('401'))
      .mockResolvedValueOnce(mockUser)
    mockedAuthService.refresh.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
    })

    await useAuthStore.getState().initialize()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user).toEqual(mockUser)
    expect(state.isLoading).toBe(false)
  })

  it('clears state when both getMe and refresh fail', async () => {
    localStorage.setItem('access_token', 'expired-token')
    localStorage.setItem('refresh_token', 'expired-refresh')

    mockedAuthService.getMe.mockRejectedValue(new Error('401'))
    mockedAuthService.refresh.mockRejectedValue(new Error('Token expired'))

    await useAuthStore.getState().initialize()

    const state = useAuthStore.getState()
    expect(state.isLoading).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })
})
