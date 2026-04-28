'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { useChatActivityStore } from '../store/chat-activity';
import { connectSocket } from '../store/socket';

function playSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
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
  const accessToken = useAuthStore((s) => s.accessToken);
  const incrementUnreadDirect = useChatActivityStore((s) => s.incrementUnreadDirect);
  const incrementUnreadRoom = useChatActivityStore((s) => s.incrementUnreadRoom);
  const incrementUnreadDirectRef = useRef(incrementUnreadDirect);
  const incrementUnreadRoomRef = useRef(incrementUnreadRoom);
  incrementUnreadDirectRef.current = incrementUnreadDirect;
  incrementUnreadRoomRef.current = incrementUnreadRoom;
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

    // НЕ отключаем при размонтировании — сокет живёт как синглтон
    return () => {};
  }, [accessToken]);

  return null;
}

