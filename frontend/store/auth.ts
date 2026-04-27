import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useNotificationsStore } from './notifications';
import { useChatActivityStore } from './chat-activity';

export type User = { id: string; email: string; name: string | null; avatarUrl?: string | null; isAdmin?: boolean };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Access token держим только в памяти (не в localStorage), чтобы снизить риск XSS.
let _accessToken: string | null = null;
export const getAccessToken = () => _accessToken;

type AuthState = {
  accessToken: string | null;
  user: User | null;
  hydrated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string | null) => void;
  logout: () => void;
  setHydrated: () => void;
  tryRestoreSession: () => Promise<boolean>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setAuth: (user, accessToken) => {
        _accessToken = accessToken;
        if (typeof window !== 'undefined') {
          const avatarKey = `connexy-profile-photo:${user.id}`;
          if (user.avatarUrl) localStorage.setItem(avatarKey, user.avatarUrl);
          else localStorage.removeItem(avatarKey);
        }
        set({ user, accessToken });
      },
      setAccessToken: (accessToken) => {
        _accessToken = accessToken;
        set({ accessToken });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          const t = _accessToken;
          const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          if (t) {
            void fetch(`${base}/auth/logout`, {
              method: 'POST',
              credentials: 'include',
              headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
            }).catch(() => {});
          }
        }
        _accessToken = null;
        useNotificationsStore.getState().clearAll();
        useChatActivityStore.getState().clearAll();
        set({ user: null, accessToken: null });
      },
      tryRestoreSession: async (): Promise<boolean> => {
        try {
          const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          const isJson = res.headers.get('content-type')?.includes('application/json');
          const data = isJson ? await res.json().catch(() => null) : null;
          if (!res.ok || !data?.ok || !data.accessToken) {
            _accessToken = null;
            set({ user: null, accessToken: null, hydrated: true });
            return false;
          }
          _accessToken = data.accessToken;
          set({
            accessToken: data.accessToken,
            user: data.user ?? null,
            hydrated: true,
          });
          return true;
        } catch {
          _accessToken = null;
          set({ user: null, accessToken: null, hydrated: true });
          return false;
        }
      },
    }),
    {
      name: 'auth',
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        // hydrated выставляется после tryRestoreSession() в Providers
      },
    },
  ),
);
