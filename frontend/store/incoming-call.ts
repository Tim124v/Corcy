import { create } from 'zustand';

export type IncomingCall = {
  fromUserId: string;
  fromName: string;
  offer: RTCSessionDescriptionInit;
  isVideo: boolean;
};

type IncomingCallState = {
  call: IncomingCall | null;
  setCall: (call: IncomingCall | null) => void;
};

export const useIncomingCallStore = create<IncomingCallState>()((set) => ({
  call: null,
  setCall: (call) => set({ call }),
}));
