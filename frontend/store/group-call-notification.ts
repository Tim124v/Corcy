import { create } from 'zustand';

export type GroupCallNotification = {
  roomId: string;
  roomName: string;
  callerName: string;
  callerId: string;
};

type GroupCallNotifState = {
  notification: GroupCallNotification | null;
  setNotification: (n: GroupCallNotification | null) => void;
};

export const useGroupCallNotifStore = create<GroupCallNotifState>()((set) => ({
  notification: null,
  setNotification: (notification) => set({ notification }),
}));
