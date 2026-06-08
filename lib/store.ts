import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api, { TOKEN_KEY } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,

  /**
   * Called once on app launch to rehydrate persisted token.
   */
  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        // Validate token is still good by fetching the current user
        const { data } = await api.get<{ id: number; name: string; email: string; phone: string | null; role: string; vendor_id: number | null }>(
          '/auth/user',
          { headers: { Authorization: `Bearer ${token}` } },
        );
        set({ token, user: data, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      // Token invalid/expired — clear it, unless a fresh login already populated state.
      const currentToken = get().token;
      if (!currentToken) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        set({ token: null, user: null, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    }
  },

  login: async (email, password) => {
    const { data } = await api.post<{
      success: boolean;
      data: { token: string; user: AuthUser };
    }>('/auth/login', { email, password });

    await SecureStore.setItemAsync(TOKEN_KEY, data.data.token);
    set({ token: data.data.token, user: data.data.user });
  },

  register: async (name, email, password, role = 'consumer') => {
    const { data } = await api.post<{
      success: boolean;
      data: { token: string; user: AuthUser };
    }>('/auth/register', {
      name,
      email,
      password,
      password_confirmation: password,
      role,
    });

    await SecureStore.setItemAsync(TOKEN_KEY, data.data.token);
    set({ token: data.data.token, user: data.data.user });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore — clear local state regardless
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null });
  },

  setUser: (user) => set({ user }),
}));
