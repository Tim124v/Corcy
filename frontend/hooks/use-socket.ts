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
  onMessageEdited?: (data: { messageId: string; text: string; editedAt: string }) => void;
  onRoomMessageEdited?: (data: { roomId: string; messageId: string; text: string; editedAt: string }) => void;
  onReactionUpdated?: (data: { messageId: string; emoji: string; userId: string; action: 'added' | 'removed' }) => void;
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
    const onMessageEdited = (d: unknown) =>
      handlersRef.current.onMessageEdited?.(d as { messageId: string; text: string; editedAt: string });
    const onRoomMessageEdited = (d: unknown) =>
      handlersRef.current.onRoomMessageEdited?.(d as {
        roomId: string;
        messageId: string;
        text: string;
        editedAt: string;
      });
    const onReactionUpdated = (d: unknown) =>
      handlersRef.current.onReactionUpdated?.(d as {
        messageId: string;
        emoji: string;
        userId: string;
        action: 'added' | 'removed';
      });

    if (handlersRef.current.onConnect) socket.on('connect', onConnect);
    if (handlersRef.current.onDisconnect) socket.on('disconnect', onDisconnect);
    if (handlersRef.current.onNewDirectMessage) socket.on('newDirectMessage', onNewDirectMessage);
    if (handlersRef.current.onNewRoomMessage) socket.on('newRoomMessage', onNewRoomMessage);
    if (handlersRef.current.onMessageRead) socket.on('messageRead', onMessageRead);
    if (handlersRef.current.onTypingDirect) socket.on('typingDirect', onTypingDirect);
    if (handlersRef.current.onTypingRoom) socket.on('typingRoom', onTypingRoom);
    if (handlersRef.current.onMessageEdited) socket.on('messageEdited', onMessageEdited);
    if (handlersRef.current.onRoomMessageEdited) socket.on('roomMessageEdited', onRoomMessageEdited);
    if (handlersRef.current.onReactionUpdated) socket.on('reactionUpdated', onReactionUpdated);

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
      if (handlersRef.current.onMessageEdited) socket.off('messageEdited', onMessageEdited);
      if (handlersRef.current.onRoomMessageEdited) socket.off('roomMessageEdited', onRoomMessageEdited);
      if (handlersRef.current.onReactionUpdated) socket.off('reactionUpdated', onReactionUpdated);
    };
  }, []); // Только при монтировании

  return { joinRoom, leaveRoom, emitTyping, emitStopTyping };
}

