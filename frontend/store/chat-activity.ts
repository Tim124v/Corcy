'use client';

import { create } from 'zustand';

type ChatActivityState = {
  unreadDirectIds: string[];
  unreadRoomIds: string[];
  unreadDirectCount: Record<string, number>;
  unreadRoomCount: Record<string, number>;
  setUnreadDirectIds: (ids: string[]) => void;
  setUnreadRoomIds: (ids: string[]) => void;
  addUnreadDirect: (peerId: string) => void;
  addUnreadRoom: (roomId: string) => void;
  markDirectAsRead: (peerId: string) => void;
  markRoomAsRead: (roomId: string) => void;
  incrementUnreadDirect: (peerId: string) => void;
  incrementUnreadRoom: (roomId: string) => void;
  clearUnreadDirect: (peerId: string) => void;
  clearUnreadRoom: (roomId: string) => void;
  clearAll: () => void;
};

export const useChatActivityStore = create<ChatActivityState>()((set) => ({
  unreadDirectIds: [],
  unreadRoomIds: [],
  unreadDirectCount: {},
  unreadRoomCount: {},
  setUnreadDirectIds: (ids) => set({ unreadDirectIds: ids }),
  setUnreadRoomIds: (ids) => set({ unreadRoomIds: ids }),
  addUnreadDirect: (peerId) =>
    set((state) => ({
      unreadDirectIds: state.unreadDirectIds.includes(peerId) ? state.unreadDirectIds : [peerId, ...state.unreadDirectIds],
    })),
  addUnreadRoom: (roomId) =>
    set((state) => ({
      unreadRoomIds: state.unreadRoomIds.includes(roomId) ? state.unreadRoomIds : [roomId, ...state.unreadRoomIds],
    })),
  markDirectAsRead: (peerId) =>
    set((state) => ({
      unreadDirectIds: state.unreadDirectIds.filter((id) => id !== peerId),
    })),
  markRoomAsRead: (roomId) =>
    set((state) => ({
      unreadRoomIds: state.unreadRoomIds.filter((id) => id !== roomId),
    })),
  incrementUnreadDirect: (peerId) =>
    set((state) => {
      const nextCount = (state.unreadDirectCount[peerId] ?? 0) + 1;
      return {
        unreadDirectCount: { ...state.unreadDirectCount, [peerId]: nextCount },
        unreadDirectIds: state.unreadDirectIds.includes(peerId) ? state.unreadDirectIds : [peerId, ...state.unreadDirectIds],
      };
    }),
  incrementUnreadRoom: (roomId) =>
    set((state) => {
      const nextCount = (state.unreadRoomCount[roomId] ?? 0) + 1;
      return {
        unreadRoomCount: { ...state.unreadRoomCount, [roomId]: nextCount },
        unreadRoomIds: state.unreadRoomIds.includes(roomId) ? state.unreadRoomIds : [roomId, ...state.unreadRoomIds],
      };
    }),
  clearUnreadDirect: (peerId) =>
    set((state) => {
      const { [peerId]: _removed, ...rest } = state.unreadDirectCount;
      return {
        unreadDirectCount: rest,
        unreadDirectIds: state.unreadDirectIds.filter((id) => id !== peerId),
      };
    }),
  clearUnreadRoom: (roomId) =>
    set((state) => {
      const { [roomId]: _removed, ...rest } = state.unreadRoomCount;
      return {
        unreadRoomCount: rest,
        unreadRoomIds: state.unreadRoomIds.filter((id) => id !== roomId),
      };
    }),
  clearAll: () => set({ unreadDirectIds: [], unreadRoomIds: [], unreadDirectCount: {}, unreadRoomCount: {} }),
}));
