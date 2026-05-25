'use client';

import {
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalTrack,
} from 'livekit-client';
import { useRef, useCallback, useEffect, useState } from 'react';

export type LiveKitPeer = {
  identity: string;
  displayName: string;
  isSpeaking: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  audioTrack: MediaStreamTrack | undefined;
  videoTrack: MediaStreamTrack | undefined;
  isLocal: boolean;
};

type LiveKitHandlers = {
  onPeersChanged: (peers: LiveKitPeer[]) => void;
  onError: (err: string) => void;
  onDisconnected: () => void;
};

function participantToPeer(p: Participant, isLocal: boolean): LiveKitPeer {
  let audioTrack: MediaStreamTrack | undefined;
  let videoTrack: MediaStreamTrack | undefined;

  p.trackPublications.forEach((pub) => {
    if (!pub.track) return;
    if (pub.kind === Track.Kind.Audio && pub.isSubscribed) {
      const mediaTrack = pub.track.mediaStreamTrack;
      if (mediaTrack) audioTrack = mediaTrack;
    }
    if (pub.kind === Track.Kind.Video && pub.isSubscribed) {
      const mediaTrack = pub.track.mediaStreamTrack;
      if (mediaTrack) videoTrack = mediaTrack;
    }
  });

  return {
    identity: p.identity,
    displayName: p.name ?? p.identity,
    isSpeaking: p.isSpeaking,
    hasAudio: Array.from(p.trackPublications.values()).some(
      (pub) => pub.kind === Track.Kind.Audio && !pub.isMuted,
    ),
    hasVideo: Array.from(p.trackPublications.values()).some(
      (pub) => pub.kind === Track.Kind.Video && !pub.isMuted,
    ),
    audioTrack,
    videoTrack,
    isLocal,
  };
}

export function useLiveKit(handlers: LiveKitHandlers) {
  const roomRef = useRef<Room | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [isConnected, setIsConnected] = useState(false);
  const localTracksRef = useRef<LocalTrack[]>([]);

  const getPeers = useCallback((): LiveKitPeer[] => {
    const room = roomRef.current;
    if (!room) return [];
    const peers: LiveKitPeer[] = [];
    if (room.localParticipant) {
      peers.push(participantToPeer(room.localParticipant, true));
    }
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      peers.push(participantToPeer(p, false));
    });
    return peers;
  }, []);

  const connect = useCallback(
    async (wsUrl: string, token: string, withVideo: boolean): Promise<boolean> => {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          simulcast: true,
        },
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        handlersRef.current.onPeersChanged(getPeers());
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        handlersRef.current.onPeersChanged(getPeers());
      });
      room.on(RoomEvent.TrackSubscribed, () => {
        handlersRef.current.onPeersChanged(getPeers());
      });
      room.on(RoomEvent.TrackUnsubscribed, () => {
        handlersRef.current.onPeersChanged(getPeers());
      });
      room.on(RoomEvent.ActiveSpeakersChanged, () => {
        handlersRef.current.onPeersChanged(getPeers());
      });
      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        handlersRef.current.onDisconnected();
      });

      try {
        await room.connect(wsUrl, token);
        roomRef.current = room;

        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
        });
        await room.localParticipant.publishTrack(audioTrack);
        localTracksRef.current = [audioTrack];

        if (withVideo) {
          try {
            const videoTrack = await createLocalVideoTrack({
              resolution: { width: 640, height: 480 },
            });
            await room.localParticipant.publishTrack(videoTrack);
            localTracksRef.current.push(videoTrack);
          } catch {
            /* камера недоступна */
          }
        }

        setIsConnected(true);
        handlersRef.current.onPeersChanged(getPeers());
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка подключения к LiveKit';
        handlersRef.current.onError(msg);
        return false;
      }
    },
    [getPeers],
  );

  const disconnect = useCallback(() => {
    localTracksRef.current.forEach((t) => t.stop());
    localTracksRef.current = [];
    roomRef.current?.disconnect();
    roomRef.current = null;
    setIsConnected(false);
  }, []);

  const toggleMic = useCallback((): boolean => {
    const audioTrack = localTracksRef.current.find((t) => t.kind === Track.Kind.Audio);
    if (!audioTrack) return false;
    const newMuted = !audioTrack.isMuted;
    void (newMuted ? audioTrack.mute() : audioTrack.unmute());
    return !newMuted;
  }, []);

  const toggleCamera = useCallback((): boolean => {
    const videoTrack = localTracksRef.current.find((t) => t.kind === Track.Kind.Video);
    if (!videoTrack) return false;
    const newMuted = !videoTrack.isMuted;
    void (newMuted ? videoTrack.mute() : videoTrack.unmute());
    return !newMuted;
  }, []);

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    try {
      const room = roomRef.current;
      if (!room) return false;
      await room.localParticipant.setScreenShareEnabled(true);
      handlersRef.current.onPeersChanged(getPeers());
      return true;
    } catch {
      return false;
    }
  }, [getPeers]);

  const stopScreenShare = useCallback(async (): Promise<void> => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(false);
    handlersRef.current.onPeersChanged(getPeers());
  }, [getPeers]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    isConnected,
    getPeers,
  };
}
