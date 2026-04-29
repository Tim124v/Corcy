'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../store/socket';

type MessageHandler = (data: unknown) => void;

export function useSocket(handlers: {
  onNewDirectMessage?: MessageHandler;
  onNewRoomMessage?: MessageHandler;
  onMessageRead?: (data: { messageId: string; readAt: string }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const joinRoom = useCallback((roomId: string) => {
    getSocket()?.emit('joinRoom', { roomId });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    getSocket()?.emit('leaveRoom', { roomId });
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => handlersRef.current.onConnect?.();
    const onDisconnect = (reason: string) => handlersRef.current.onDisconnect?.();
    const onNewDirectMessage = (data: unknown) => handlersRef.current.onNewDirectMessage?.(data);
    const onNewRoomMessage = (data: unknown) => handlersRef.current.onNewRoomMessage?.(data);
    const onMessageRead = (data: unknown) =>
      handlersRef.current.onMessageRead?.(data as { messageId: string; readAt: string });

    if (handlersRef.current.onConnect) socket.on('connect', onConnect);
    if (handlersRef.current.onDisconnect) socket.on('disconnect', onDisconnect);
    if (handlersRef.current.onNewDirectMessage) socket.on('newDirectMessage', onNewDirectMessage);
    if (handlersRef.current.onNewRoomMessage) socket.on('newRoomMessage', onNewRoomMessage);
    if (handlersRef.current.onMessageRead) socket.on('messageRead', onMessageRead);

    if (socket.connected) handlersRef.current.onConnect?.();

    return () => {
      // Не отключаем — синглтон управляется через SocketProvider
      if (handlersRef.current.onConnect) socket.off('connect', onConnect);
      if (handlersRef.current.onDisconnect) socket.off('disconnect', onDisconnect);
      if (handlersRef.current.onNewDirectMessage) socket.off('newDirectMessage', onNewDirectMessage);
      if (handlersRef.current.onNewRoomMessage) socket.off('newRoomMessage', onNewRoomMessage);
      if (handlersRef.current.onMessageRead) socket.off('messageRead', onMessageRead);
    };
  }, []); // Только при монтировании

  return { joinRoom, leaveRoom };
}

