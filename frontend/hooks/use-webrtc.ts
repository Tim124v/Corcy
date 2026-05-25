'use client';

import { useRef, useCallback, useEffect } from 'react';
import { getSocket } from '../store/socket';

function buildIceServers(): RTCIceServer[] {
  const base: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const json = process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return [...base, ...(parsed as RTCIceServer[])];
      }
    } catch {
      /* ignore invalid JSON */
    }
  }

  const turnUrls = process.env.NEXT_PUBLIC_TURN_URLS?.trim();
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();
  if (turnUrls && turnUser && turnCred) {
    const urls = turnUrls.split(',').map((s) => s.trim()).filter(Boolean);
    if (urls.length) base.push({ urls, username: turnUser, credential: turnCred });
  }

  const hasTurn = base.some(
    (s) => (typeof s.urls === 'string' ? s.urls : s.urls[0])?.startsWith('turn'),
  );
  if (!hasTurn && process.env.NODE_ENV !== 'production') {
    console.warn(
      '[WebRTC] TURN-сервер не настроен. Звонки могут не работать за Symmetric NAT.\n' +
        'Добавьте NEXT_PUBLIC_TURN_URLS, NEXT_PUBLIC_TURN_USERNAME, NEXT_PUBLIC_TURN_CREDENTIAL\n' +
        'в frontend/.env.local. Подробнее: frontend/.env.example',
    );
  }
  return base;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: buildIceServers(),
};

type CallHandlers = {
  onRemoteStream: (stream: MediaStream) => void;
  onCallEnded: () => void;
  onError: (err: string) => void;
};

export function useWebRTC(handlers: CallHandlers) {
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const createPeerConnection = useCallback((peerId: string) => {
    const socket = getSocket();
    if (!socket) return null;

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);

    localStream.current?.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream.current!);
    });

    peerConnection.ontrack = (e) => {
      if (e.streams[0]) handlersRef.current.onRemoteStream(e.streams[0]);
    };

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('call:ice-candidate', {
          toUserId: peerId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        handlersRef.current.onCallEnded();
      }
    };

    return peerConnection;
  }, []);

  const startCall = useCallback(
    async (peerId: string, video: boolean) => {
      const socket = getSocket();
      if (!socket) return;

      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video,
        });

        pc.current = createPeerConnection(peerId);
        if (!pc.current) return;

        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);

        socket.emit('call:offer', { toUserId: peerId, offer });
      } catch (err) {
        handlersRef.current.onError(
          err instanceof Error ? err.message : 'Не удалось получить доступ к камере/микрофону',
        );
      }
    },
    [createPeerConnection],
  );

  const answerCall = useCallback(
    async (peerId: string, offer: RTCSessionDescriptionInit, video: boolean) => {
      const socket = getSocket();
      if (!socket) return;

      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video,
        });

        pc.current = createPeerConnection(peerId);
        if (!pc.current) return;

        await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);

        socket.emit('call:answer', { toUserId: peerId, answer });
      } catch (err) {
        handlersRef.current.onError(
          err instanceof Error ? err.message : 'Ошибка при ответе на звонок',
        );
      }
    },
    [createPeerConnection],
  );

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    try {
      await pc.current?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      /* ignore invalid / late candidates */
    }
  }, []);

  const setRemoteAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    try {
      await pc.current?.setRemoteDescription(new RTCSessionDescription(answer));
    } catch {
      /* ignore */
    }
  }, []);

  const endCall = useCallback((peerId?: string) => {
    const socket = getSocket();
    if (peerId && socket) socket.emit('call:end', { toUserId: peerId });

    pc.current?.close();
    pc.current = null;

    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
  }, []);

  const toggleMic = useCallback(() => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) track.enabled = !track.enabled;
    return track?.enabled ?? false;
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) track.enabled = !track.enabled;
    return track?.enabled ?? false;
  }, []);

  const getLocalStream = useCallback(() => localStream.current, []);

  const screenStream = useRef<MediaStream | null>(null);

  const stopScreenShare = useCallback(async (): Promise<void> => {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;

    const camTrack = localStream.current?.getVideoTracks()[0];
    if (camTrack) {
      const senders = pc.current?.getSenders() ?? [];
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender) await videoSender.replaceTrack(camTrack);
    }
  }, []);

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await (
        navigator.mediaDevices as MediaDevices & {
          getDisplayMedia: (c?: MediaStreamConstraints) => Promise<MediaStream>;
        }
      ).getDisplayMedia({ video: true, audio: false });

      screenStream.current = stream;
      const [screenTrack] = stream.getVideoTracks();
      if (!screenTrack) return false;

      const senders = pc.current?.getSenders() ?? [];
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(screenTrack);
      }

      screenTrack.onended = () => {
        void stopScreenShare();
      };

      return true;
    } catch {
      return false;
    }
  }, [stopScreenShare]);

  useEffect(() => {
    return () => {
      pc.current?.close();
      localStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    startCall,
    answerCall,
    addIceCandidate,
    setRemoteAnswer,
    endCall,
    toggleMic,
    toggleCamera,
    getLocalStream,
    startScreenShare,
    stopScreenShare,
  };
}
