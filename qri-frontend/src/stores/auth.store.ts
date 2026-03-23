import { create } from 'zustand';
import * as authService from '@/services/auth.service';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const response = await authService.login(email, password);

    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);

    set({
      user: response.user,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refresh_token');

    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // Ignore logout API errors -- we clear local state regardless
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

      set({
        user: null,
        isAuthenticated: false,
      });
    }
  },

  refreshAuth: async () => {
    const refreshToken = localStorage.getItem('refresh_token');

    if (!refreshToken) {
      set({ user: null, isAuthenticated: false });
      return;
    }

    try {
      const response = await authService.refresh(refreshToken);

      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);

      // Re-fetch user profile with the new token
      const user = await authService.getMe();
      set({ user, isAuthenticated: true });
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null, isAuthenticated: false });
    }
  },

  initialize: async () => {
    const accessToken = localStorage.getItem('access_token');

    if (!accessToken) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const user = await authService.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // Token might be expired -- try to refresh
      try {
        await get().refreshAuth();
      } catch {
        // Refresh also failed -- clear everything
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
      set((state) => ({
        isLoading: false,
        // Keep whatever refreshAuth set, or ensure clean state
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }));
    }
  },
}));
