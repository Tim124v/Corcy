'use client';

import { create } from 'zustand';

type ChatActivityState = {
  unreadDirectIds: string[];
  unreadRoomIds: string[];
  setUnreadDirectIds: (ids: string[]) => void;
  setUnreadRoomIds: (ids: string[]) => void;
  addUnreadDirect: (peerId: string) => void;
  addUnreadRoom: (roomId: string) => void;
  markDirectAsRead: (peerId: string) => void;
  markRoomAsRead: (roomId: string) => void;
  clearAll: () => void;
};

export const useChatActivityStore = create<ChatActivityState>()((set) => ({
  unreadDirectIds: [],
  unreadRoomIds: [],
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
  clearAll: () => set({ unreadDirectIds: [], unreadRoomIds: [] }),
}));
