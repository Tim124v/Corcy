'use client';

import { useAuthStore } from '../store/auth';
import { useSocket } from '../hooks/use-socket';
import { useChatActivityStore } from '../store/chat-activity';
import { useBrowserNotifications } from '../hooks/use-browser-notifications';

export function SocketProvider() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const incrementUnreadDirect = useChatActivityStore((s) => s.incrementUnreadDirect);
  const incrementUnreadRoom = useChatActivityStore((s) => s.incrementUnreadRoom);
  const { showNotification } = useBrowserNotifications();

  useSocket({
    onNewDirectMessage: (data) => {
      const msg = data as { senderId: string; text?: string; senderName?: string };
      if (!msg.senderId) return;

      incrementUnreadDirect(msg.senderId);

      // Звуковое уведомление (Web Audio API)
      try {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      } catch {}

      showNotification('New message', {
        body: msg.text ? `${msg.senderName || 'Someone'}: ${msg.text.slice(0, 50)}` : 'New message',
        tag: `direct-${msg.senderId}`,
      });
    },

    onNewRoomMessage: (data) => {
      const msg = data as { roomId: string; text?: string; roomName?: string };
      if (!msg.roomId) return;

      incrementUnreadRoom(msg.roomId);

      try {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      } catch {}

      showNotification('New room message', {
        body: msg.text ? `${msg.roomName || 'Room'}: ${msg.text.slice(0, 50)}` : 'New message',
        tag: `room-${msg.roomId}`,
      });
    },
  });

  // Не рендерим ничего — просто поддерживаем соединение
  if (!user || !accessToken) return null;
  return null;
}

