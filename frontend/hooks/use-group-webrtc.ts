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
      /* ignore */
    }
  }
  const turnUrls = process.env.NEXT_PUBLIC_TURN_URLS?.trim();
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();
  if (turnUrls && turnUser && turnCred) {
    const urls = turnUrls.split(',').map((s) => s.trim()).filter(Boolean);
    if (urls.length) base.push({ urls, username: turnUser, credential: turnCred });
  }
  return base;
}

const ICE_CONFIG: RTCConfiguration = { iceServers: buildIceServers() };

export type GroupPeer = {
  userId: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  displayName: string;
};

type GroupCallHandlers = {
  onPeersChanged: (peers: GroupPeer[]) => void;
  onError: (err: string) => void;
};

export function useGroupWebRTC(roomId: string, currentUserId: string, handlers: GroupCallHandlers) {
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreams = useRef<Map<string, MediaStream | null>>(new Map());
  const peerNames = useRef<Map<string, string>>(new Map());
  const localStream = useRef<MediaStream | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  const notifyPeersChanged = useCallback(() => {
    const peers: GroupPeer[] = [];
    pcs.current.forEach((pc, userId) => {
      peers.push({
        userId,
        stream: remoteStreams.current.get(userId) ?? null,
        connectionState: pc.connectionState,
        displayName: peerNames.current.get(userId) ?? userId.slice(0, 8),
      });
    });
    handlersRef.current.onPeersChanged(peers);
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = pcs.current.get(peerId);
      if (existing) {
        existing.close();
        pcs.current.delete(peerId);
        remoteStreams.current.delete(peerId);
      }

      const pc = new RTCPeerConnection(ICE_CONFIG);

      localStream.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });

      pc.ontrack = (e) => {
        if (e.streams[0]) {
          remoteStreams.current.set(peerId, e.streams[0]);
          notifyPeersChanged();
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          getSocket()?.emit('gcall:ice-candidate', {
            roomId: roomIdRef.current,
            toUserId: peerId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        notifyPeersChanged();
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          pcs.current.delete(peerId);
          remoteStreams.current.delete(peerId);
          notifyPeersChanged();
        }
      };

      pcs.current.set(peerId, pc);
      return pc;
    },
    [notifyPeersChanged],
  );

  const joinCall = useCallback(
    async (withVideo: boolean) => {
      const socket = getSocket();
      if (!socket) {
        handlersRef.current.onError('Нет соединения с сервером');
        return null;
      }

      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: withVideo,
        });
      } catch {
        handlersRef.current.onError('Не удалось получить доступ к микрофону/камере');
        return null;
      }

      socket.emit('gcall:join', { roomId: roomIdRef.current });
      return localStream.current;
    },
    [],
  );

  const sendOffer = useCallback(
    async (peerId: string) => {
      const socket = getSocket();
      if (!socket) return;

      const pc = createPeerConnection(peerId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('gcall:offer', {
          roomId: roomIdRef.current,
          toUserId: peerId,
          offer,
        });
      } catch {
        handlersRef.current.onError(`Ошибка при соединении с ${peerId}`);
      }
    },
    [createPeerConnection],
  );

  const leaveCall = useCallback(() => {
    getSocket()?.emit('gcall:leave', { roomId: roomIdRef.current });

    pcs.current.forEach((pc) => pc.close());
    pcs.current.clear();
    remoteStreams.current.clear();
    peerNames.current.clear();

    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;

    notifyPeersChanged();
  }, [notifyPeersChanged]);

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
      const replacePromises: Promise<void>[] = [];
      pcs.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) replacePromises.push(sender.replaceTrack(camTrack));
      });
      await Promise.all(replacePromises);
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

      const replacePromises: Promise<void>[] = [];
      pcs.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) replacePromises.push(sender.replaceTrack(screenTrack));
      });
      await Promise.all(replacePromises);

      screenTrack.onended = () => {
        void stopScreenShare();
      };

      return true;
    } catch {
      return false;
    }
  }, [stopScreenShare]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onPeerJoined = (data: unknown) => {
      const d = data as { userId: string; roomId: string; displayName?: string };
      if (!d?.userId || d.roomId !== roomIdRef.current) return;
      if (d.userId === currentUserIdRef.current) return;
      if (!localStream.current) return;
      peerNames.current.set(d.userId, d.displayName ?? d.userId.slice(0, 8));
      if (currentUserIdRef.current < d.userId) {
        void sendOffer(d.userId);
      }
    };

    const onOffer = async (data: unknown) => {
      const d = data as { fromUserId: string; roomId: string; offer: RTCSessionDescriptionInit };
      if (!d?.fromUserId || d.roomId !== roomIdRef.current || !d?.offer) return;
      if (!localStream.current) return;

      const sock = getSocket();
      const pc = createPeerConnection(d.fromUserId);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sock?.emit('gcall:answer', {
          roomId: roomIdRef.current,
          toUserId: d.fromUserId,
          answer,
        });
      } catch {
        handlersRef.current.onError(`Ошибка при ответе ${d.fromUserId}`);
      }
    };

    const onAnswer = async (data: unknown) => {
      const d = data as { fromUserId: string; roomId: string; answer: RTCSessionDescriptionInit };
      if (!d?.fromUserId || d.roomId !== roomIdRef.current || !d?.answer) return;

      const pc = pcs.current.get(d.fromUserId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(d.answer));
      } catch {
        /* ignore */
      }
    };

    const onIce = async (data: unknown) => {
      const d = data as { fromUserId: string; roomId: string; candidate: RTCIceCandidateInit };
      if (!d?.fromUserId || d.roomId !== roomIdRef.current || !d?.candidate) return;

      const pc = pcs.current.get(d.fromUserId);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(d.candidate));
      } catch {
        /* ignore stale candidates */
      }
    };

    const onPeerLeft = (data: unknown) => {
      const d = data as { userId: string; roomId: string };
      if (!d?.userId || d.roomId !== roomIdRef.current) return;
      if (d.userId === currentUserIdRef.current) return;

      const pc = pcs.current.get(d.userId);
      if (pc) {
        pc.close();
        pcs.current.delete(d.userId);
      }
      remoteStreams.current.delete(d.userId);
      peerNames.current.delete(d.userId);
      notifyPeersChanged();
    };

    socket.on('gcall:peer-joined', onPeerJoined);
    socket.on('gcall:offer', (d) => {
      void onOffer(d);
    });
    socket.on('gcall:answer', (d) => {
      void onAnswer(d);
    });
    socket.on('gcall:ice-candidate', (d) => {
      void onIce(d);
    });
    socket.on('gcall:peer-left', onPeerLeft);

    return () => {
      socket.off('gcall:peer-joined', onPeerJoined);
      socket.off('gcall:offer');
      socket.off('gcall:answer');
      socket.off('gcall:ice-candidate');
      socket.off('gcall:peer-left', onPeerLeft);
    };
  }, [createPeerConnection, sendOffer, notifyPeersChanged]);

  useEffect(() => {
    return () => {
      leaveCall();
    };
  }, [leaveCall]);

  return {
    joinCall,
    leaveCall,
    toggleMic,
    toggleCamera,
    getLocalStream,
    startScreenShare,
    stopScreenShare,
  };
}
