'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth';
import { useChatActivityStore } from '../store/chat-activity';
import { connectSocket, getSocket } from '../store/socket';
import { usePresenceStore } from '../store/presence';

function playSound() {
  try {
    const ctx = new AudioContext();

    // Звук похожий на iOS уведомление — два тона
    const times = [0, 0.1];
    const freqs = [1046, 1318]; // C6 и E6

    times.forEach((startTime, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = freqs[i]!;
      osc.type = 'sine';

      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + 0.3);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + 0.3);
    });
  } catch {}
}

function notify(title: string, body: string, tag: string) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/connexy_favicon.svg', tag });
  } catch {}
}

export function SocketProvider() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const incrementUnreadDirect = useChatActivityStore((s) => s.incrementUnreadDirect);
  const incrementUnreadRoom = useChatActivityStore((s) => s.incrementUnreadRoom);
  const setOnlineIds = usePresenceStore((s) => s.setOnlineIds);
  const setOnline = usePresenceStore((s) => s.setOnline);
  const incrementUnreadDirectRef = useRef(incrementUnreadDirect);
  const incrementUnreadRoomRef = useRef(incrementUnreadRoom);
  const setOnlineIdsRef = useRef(setOnlineIds);
  const setOnlineRef = useRef(setOnline);
  incrementUnreadDirectRef.current = incrementUnreadDirect;
  incrementUnreadRoomRef.current = incrementUnreadRoom;
  setOnlineIdsRef.current = setOnlineIds;
  setOnlineRef.current = setOnline;
  const initialized = useRef(false);

  useEffect(() => {
    if (!accessToken || initialized.current) return;
    initialized.current = true;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    }

    const socket = connectSocket(accessToken);

    socket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('[WS] SocketProvider connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.log('[WS] SocketProvider disconnected:', reason);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('newDirectMessage', (data: unknown) => {
      const msg = data as { senderId: string; text?: string };
      if (!msg?.senderId) return;
      incrementUnreadDirectRef.current(msg.senderId);
      playSound();
      notify('CONNEXY', msg.text?.slice(0, 80) || 'New message', `direct-${msg.senderId}`);
    });

    socket.on('newRoomMessage', (data: unknown) => {
      const msg = data as { roomId: string; text?: string };
      if (!msg?.roomId) return;
      incrementUnreadRoomRef.current(msg.roomId);
      playSound();
      notify('CONNEXY', msg.text?.slice(0, 80) || 'New room message', `room-${msg.roomId}`);
    });

    socket.on('presenceInit', (data: unknown) => {
      const d = data as { onlineIds: string[] };
      if (Array.isArray(d?.onlineIds)) setOnlineIdsRef.current(d.onlineIds);
    });

    socket.on('presenceUpdate', (data: unknown) => {
      const d = data as { userId: string; online: boolean };
      if (d?.userId) setOnlineRef.current(d.userId, d.online);
    });

    socket.on('call:incoming', (data: unknown) => {
      const d = data as { fromUserId: string; offer: RTCSessionDescriptionInit };
      if (!d?.fromUserId || !d?.offer) return;

      const accept = window.confirm('Входящий звонок. Ответить?');

      if (accept) {
        const encodedOffer = encodeURIComponent(JSON.stringify(d.offer));
        const hasVideo = typeof d.offer.sdp === 'string' && d.offer.sdp.includes('m=video');
        router.push(
          `/calls?peerId=${d.fromUserId}&incoming=true&offer=${encodedOffer}&video=${hasVideo ? 'true' : 'false'}`,
        );
      } else {
        getSocket()?.emit('call:reject', { toUserId: d.fromUserId });
      }
    });

    // НЕ отключаем при размонтировании — сокет живёт как синглтон
    return () => {};
  }, [accessToken, router]);

  return null;
}

