import { io, Socket } from 'socket.io-client';
import { API_URL } from '../constants/api';

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket && currentToken === token) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  socket = io(API_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = null;
}
