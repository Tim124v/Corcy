import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useNotificationsStore } from './notifications';
import { useChatActivityStore } from './chat-activity';

export type User = { id: string; email: string; name: string | null; avatarUrl?: string | null };

type AuthState = {
  accessToken: string | null;
  user: User | null;
  hydrated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
  setHydrated: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setAuth: (user, accessToken) => {
        if (typeof window !== 'undefined') localStorage.setItem('accessToken', accessToken);
        if (typeof window !== 'undefined') {
          const avatarKey = `connexy-profile-photo:${user.id}`;
          if (user.avatarUrl) localStorage.setItem(avatarKey, user.avatarUrl);
          else localStorage.removeItem(avatarKey);
        }
        set({ user, accessToken });
      },
      logout: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('accessToken');
        useNotificationsStore.getState().clearAll();
        useChatActivityStore.getState().clearAll();
        set({ user: null, accessToken: null });
      },
    }),
    {
      name: 'auth',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
