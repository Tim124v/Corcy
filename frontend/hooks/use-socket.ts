'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../store/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Синглтон сокета — живёт вне React, не уничтожается при Fast Refresh
let _socket: Socket | null = null;

function getOrCreateSocket(token: string): Socket {
  if (_socket && _socket.connected) {
    return _socket;
  }
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  _socket = io(API_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 20000,
  });
  return _socket;
}

type MessageHandler = (data: unknown) => void;

export function useSocket(handlers: {
  onNewDirectMessage?: MessageHandler;
  onNewRoomMessage?: MessageHandler;
  onConnect?: () => void;
  onDisconnect?: () => void;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const listenersAttached = useRef(false);

  const joinRoom = useCallback((roomId: string) => {
    _socket?.emit('joinRoom', { roomId });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    _socket?.emit('leaveRoom', { roomId });
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = getOrCreateSocket(token);

    // Вешаем обработчики только один раз
    if (!listenersAttached.current) {
      listenersAttached.current = true;

      socket.on('connect', () => {
        // eslint-disable-next-line no-console
        console.log('[WS] Connected:', socket.id);
        handlersRef.current.onConnect?.();
      });

      socket.on('connect_error', (err) => {
        // eslint-disable-next-line no-console
        console.log('[WS] Connect error:', err.message);
      });

      socket.on('disconnect', (reason) => {
        // eslint-disable-next-line no-console
        console.log('[WS] Disconnected:', reason);
        handlersRef.current.onDisconnect?.();
      });

      socket.on('newDirectMessage', (data: unknown) => {
        handlersRef.current.onNewDirectMessage?.(data);
      });

      socket.on('newRoomMessage', (data: unknown) => {
        handlersRef.current.onNewRoomMessage?.(data);
      });
    }

    // Если уже подключены — сразу вызвать onConnect
    if (socket.connected) {
      handlersRef.current.onConnect?.();
    }

    // НЕ отключаем сокет при размонтировании — он живёт как синглтон
    return () => {};
  }, []); // Только при монтировании

  return { joinRoom, leaveRoom };
}

