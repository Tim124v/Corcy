'use client';

import { create } from 'zustand';

type PresenceState = {
  onlineIds: Set<string>;
  setOnlineIds: (ids: string[]) => void;
  setOnline: (userId: string, online: boolean) => void;
  isOnline: (userId: string) => boolean;
};

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  onlineIds: new Set(),
  setOnlineIds: (ids) => set({ onlineIds: new Set(ids) }),
  setOnline: (userId, online) =>
    set((state) => {
      const next = new Set(state.onlineIds);
      if (online) next.add(userId);
      else next.delete(userId);
      return { onlineIds: next };
    }),
  isOnline: (userId) => get().onlineIds.has(userId),
}));

