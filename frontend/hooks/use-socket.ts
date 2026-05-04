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
  onTypingDirect?: (data: { fromUserId: string; isTyping: boolean }) => void;
  onTypingRoom?: (data: { fromUserId: string; roomId: string; isTyping: boolean }) => void;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const joinRoom = useCallback((roomId: string) => {
    getSocket()?.emit('joinRoom', { roomId });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    getSocket()?.emit('leaveRoom', { roomId });
  }, []);

  const emitTyping = useCallback((target: { peerId?: string; roomId?: string }) => {
    getSocket()?.emit('typing', target);
  }, []);

  const emitStopTyping = useCallback((target: { peerId?: string; roomId?: string }) => {
    getSocket()?.emit('stopTyping', target);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => handlersRef.current.onConnect?.();
    const onDisconnect = () => handlersRef.current.onDisconnect?.();
    const onNewDirectMessage = (data: unknown) => handlersRef.current.onNewDirectMessage?.(data);
    const onNewRoomMessage = (data: unknown) => handlersRef.current.onNewRoomMessage?.(data);
    const onMessageRead = (data: unknown) =>
      handlersRef.current.onMessageRead?.(data as { messageId: string; readAt: string });
    const onTypingDirect = (d: unknown) =>
      handlersRef.current.onTypingDirect?.(d as { fromUserId: string; isTyping: boolean });
    const onTypingRoom = (d: unknown) =>
      handlersRef.current.onTypingRoom?.(d as { fromUserId: string; roomId: string; isTyping: boolean });

    if (handlersRef.current.onConnect) socket.on('connect', onConnect);
    if (handlersRef.current.onDisconnect) socket.on('disconnect', onDisconnect);
    if (handlersRef.current.onNewDirectMessage) socket.on('newDirectMessage', onNewDirectMessage);
    if (handlersRef.current.onNewRoomMessage) socket.on('newRoomMessage', onNewRoomMessage);
    if (handlersRef.current.onMessageRead) socket.on('messageRead', onMessageRead);
    if (handlersRef.current.onTypingDirect) socket.on('typingDirect', onTypingDirect);
    if (handlersRef.current.onTypingRoom) socket.on('typingRoom', onTypingRoom);

    if (socket.connected) handlersRef.current.onConnect?.();

    return () => {
      // Не отключаем — синглтон управляется через SocketProvider
      if (handlersRef.current.onConnect) socket.off('connect', onConnect);
      if (handlersRef.current.onDisconnect) socket.off('disconnect', onDisconnect);
      if (handlersRef.current.onNewDirectMessage) socket.off('newDirectMessage', onNewDirectMessage);
      if (handlersRef.current.onNewRoomMessage) socket.off('newRoomMessage', onNewRoomMessage);
      if (handlersRef.current.onMessageRead) socket.off('messageRead', onMessageRead);
      if (handlersRef.current.onTypingDirect) socket.off('typingDirect', onTypingDirect);
      if (handlersRef.current.onTypingRoom) socket.off('typingRoom', onTypingRoom);
    };
  }, []); // Только при монтировании

  return { joinRoom, leaveRoom, emitTyping, emitStopTyping };
}

