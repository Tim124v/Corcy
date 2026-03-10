'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type NotificationType = 'invite' | 'room' | 'security' | 'system';

export type NotificationCategorySettings = Record<NotificationType, boolean>;

const defaultCategorySettings: NotificationCategorySettings = {
  invite: true,
  room: true,
  security: true,
  system: true,
};

type NotificationsState = {
  items: AppNotification[];
  enabled: boolean;
  categoryEnabled: NotificationCategorySettings;
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  setEnabled: (enabled: boolean) => void;
  setCategoryEnabled: (type: NotificationType, enabled: boolean) => void;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
};

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [],
      enabled: true,
      categoryEnabled: defaultCategorySettings,
      addNotification: (notification) =>
        set((state) => {
          if (!state.enabled || !state.categoryEnabled[notification.type]) return state;

          return {
            items: [
              {
                ...notification,
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: new Date().toISOString(),
                read: false,
              },
              ...state.items,
            ].slice(0, 50),
          };
        }),
      setEnabled: (enabled) =>
        set((state) => ({
          enabled,
          items: enabled ? state.items : state.items.map((item) => (item.read ? item : { ...item, read: true })),
        })),
      setCategoryEnabled: (type, enabled) =>
        set((state) => ({
          categoryEnabled: {
            ...state.categoryEnabled,
            [type]: enabled,
          },
          items: enabled
            ? state.items
            : state.items.map((item) => (item.type === type && !item.read ? { ...item, read: true } : item)),
        })),
      markAllAsRead: () =>
        set((state) => ({
          items: state.items.map((item) => (item.read ? item : { ...item, read: true })),
        })),
      markAsRead: (id) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
        })),
      clearAll: () => set({ items: [] }),
    }),
    {
      name: 'connexy-notifications',
    },
  ),
);
