import { create } from 'zustand';
import { SecureStorage } from '../lib/secure-storage';
import { API_URL } from '../constants/api';

export type User = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  plan?: string;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  tryRestoreSession: () => Promise<boolean>;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStorage.setRefreshToken(refreshToken);
    await SecureStorage.setUser(user);
    set({ user, accessToken, refreshToken });
  },

  logout: async () => {
    const { accessToken } = get();
    if (accessToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Client': 'mobile',
        },
      }).catch(() => {});
    }
    await SecureStorage.clearRefreshToken();
    await SecureStorage.clearUser();
    set({ user: null, accessToken: null, refreshToken: null });
  },

  tryRestoreSession: async () => {
    const storedRefresh = await SecureStorage.getRefreshToken();
    if (!storedRefresh) {
      set({ hydrated: true });
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok: boolean;
        accessToken?: string;
        refreshToken?: string;
        user?: User;
      } | null;

      if (!res.ok || !data?.ok || !data.accessToken || !data.user) {
        await SecureStorage.clearRefreshToken();
        set({ hydrated: true });
        return false;
      }

      await SecureStorage.setRefreshToken(data.refreshToken ?? storedRefresh);
      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? storedRefresh,
        hydrated: true,
      });
      return true;
    } catch {
      set({ hydrated: true });
      return false;
    }
  },
}));
