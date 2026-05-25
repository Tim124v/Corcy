'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { useSocket } from '../../hooks/use-socket';
import { useGroupWebRTC, type GroupPeer } from '../../hooks/use-group-webrtc';
import { useLiveKit, type LiveKitPeer } from '../../hooks/use-livekit';

type CallMode = 'checking' | 'mesh' | 'livekit' | 'error';

function LiveKitTile({ peer }: { peer: LiveKitPeer }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.videoTrack) {
      const stream = new MediaStream([peer.videoTrack]);
      videoRef.current.srcObject = stream;
    }
  }, [peer.videoTrack]);

  const initials = peer.displayName.slice(0, 2).toUpperCase();

  return (
    <div
      className={`relative min-h-[160px] overflow-hidden rounded-2xl bg-slate-800/60 ring-2 transition ${
        peer.isSpeaking ? 'ring-indigo-400' : 'ring-transparent'
      }`}
    >
      {peer.videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={peer.isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold ${
              peer.isLocal ? 'bg-indigo-600' : 'bg-slate-600'
            }`}
          >
            {initials}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-0.5 text-[11px]">
        <span>{peer.isLocal ? `${peer.displayName} (Вы)` : peer.displayName}</span>
        {!peer.hasAudio && <span>🔇</span>}
        {peer.isSpeaking && (
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
        )}
      </div>
    </div>
  );
}

function GroupCallInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, accessToken } = useAuthStore();
  const { joinRoom, leaveRoom } = useSocket({});

  const roomId = params.get('roomId') ?? '';
  const roomName = decodeURIComponent(params.get('roomName') ?? 'Комната');
  const withVideo = params.get('video') === 'true';

  const [peers, setPeers] = useState<GroupPeer[]>([]);
  const [callMode, setCallMode] = useState<CallMode>('checking');
  const [livekitPeers, setLivekitPeers] = useState<LiveKitPeer[]>([]);
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(withVideo);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [memberMap, setMemberMap] = useState<Record<string, { name: string | null; email: string }>>({});

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleLeaveRef = useRef<() => void>(() => {});

  const { joinCall, leaveCall, toggleMic, toggleCamera, startScreenShare, stopScreenShare } = useGroupWebRTC(
    roomId,
    user?.id ?? '',
    {
      onPeersChanged: (updated) => setPeers(updated),
      onError: (err) => setError(err),
    },
  );

  const livekit = useLiveKit({
    onPeersChanged: setLivekitPeers,
    onError: (err) => setError(err),
    onDisconnected: () => handleLeaveRef.current(),
  });

  useEffect(() => {
    if (!roomId || !accessToken) return;
    void api<{ userId: string; name: string | null; email: string }[]>(`/rooms/${roomId}/members`)
      .then((members) => {
        const map: Record<string, { name: string | null; email: string }> = {};
        members.forEach((m) => {
          map[m.userId] = { name: m.name, email: m.email };
        });
        setMemberMap(map);
      })
      .catch(() => {});
  }, [roomId, accessToken]);

  const handleLeave = useCallback(() => {
    if (callMode === 'livekit') {
      livekit.disconnect();
    } else {
      leaveCall();
    }
    if (durationTimer.current) clearInterval(durationTimer.current);
    router.replace('/dashboard');
  }, [callMode, livekit, leaveCall, router]);

  handleLeaveRef.current = handleLeave;

  const handleJoin = useCallback(async () => {
    setJoining(true);
    setError(null);

    try {
      const tokenRes = await api<{
        ok: boolean;
        token?: string;
        wsUrl?: string;
        fallback?: string;
        error?: string;
      }>(`/rooms/${roomId}/call-token`, { method: 'POST' });

      if (tokenRes.ok && tokenRes.token && tokenRes.wsUrl) {
        setCallMode('livekit');
        const ok = await livekit.connect(tokenRes.wsUrl, tokenRes.token, withVideo);
        if (!ok) {
          setCallMode('error');
          return;
        }
      } else {
        setCallMode('mesh');
        const stream = await joinCall(withVideo);
        if (!stream) {
          setCallMode('error');
          return;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }

      setJoined(true);
      durationTimer.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      setCallMode('error');
      setError('Не удалось подключиться к звонку');
    } finally {
      setJoining(false);
    }
  }, [roomId, withVideo, livekit, joinCall]);

  const handleToggleMic = useCallback(() => {
    const enabled = callMode === 'livekit' ? livekit.toggleMic() : toggleMic();
    setMicOn(enabled);
  }, [callMode, livekit, toggleMic]);

  const handleToggleCamera = useCallback(() => {
    const enabled = callMode === 'livekit' ? livekit.toggleCamera() : toggleCamera();
    setCamOn(enabled);
  }, [callMode, livekit, toggleCamera]);

  const handleScreenShare = useCallback(async () => {
    if (screenSharing) {
      if (callMode === 'livekit') {
        await livekit.stopScreenShare();
      } else {
        await stopScreenShare();
      }
      setScreenSharing(false);
    } else {
      const ok =
        callMode === 'livekit' ? await livekit.startScreenShare() : await startScreenShare();
      if (ok) setScreenSharing(true);
    }
  }, [callMode, screenSharing, livekit, startScreenShare, stopScreenShare]);

  useEffect(() => {
    if (!roomId) return;
    joinRoom(roomId);
    return () => leaveRoom(roomId);
  }, [roomId, joinRoom, leaveRoom]);

  useEffect(() => {
    peers.forEach((peer) => {
      const el = remoteVideoRefs.current.get(peer.userId);
      if (el && peer.stream && el.srcObject !== peer.stream) {
        el.srcObject = peer.stream;
      }
    });
  }, [peers]);

  useEffect(() => {
    if (!accessToken || !roomId) {
      router.replace('/dashboard');
      return;
    }
    void handleJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (durationTimer.current) clearInterval(durationTimer.current);
      livekit.disconnect();
      leaveCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const participantCount =
    callMode === 'livekit' ? livekitPeers.length : peers.length + 1;
  const meshPeerCount = peers.length;
  const totalTiles = callMode === 'livekit' ? livekitPeers.length : peers.length + 1;
  const gridCols =
    totalTiles <= 1 ? 'grid-cols-1' : totalTiles <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#080d1a] text-white">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/30 px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold">{roomName}</h1>
          <p className="text-xs text-white/50">
            {joined ? formatDuration(duration) : joining ? 'Подключение…' : 'Групповой звонок'}
            {joined && participantCount > 0 && ` · ${participantCount} участника`}
          </p>
        </div>
      </div>

      {callMode !== 'checking' && (
        <div className="flex shrink-0 items-center justify-center gap-2 py-1.5 text-[10px] text-slate-500">
          {callMode === 'livekit' ? (
            <span className="flex items-center gap-1 text-violet-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
              SFU — LiveKit
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              P2P Mesh
            </span>
          )}
          {callMode === 'mesh' && (
            <span className="text-slate-600">· Рекомендуется до 6 участников</span>
          )}
        </div>
      )}

      {callMode === 'mesh' && meshPeerCount >= 4 && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-400">
          При большом количестве участников качество может снизиться. Настройте LiveKit для SFU.
        </div>
      )}

      {error && (
        <div className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-center text-xs text-red-400">
          {error}
        </div>
      )}

      {callMode === 'livekit' ? (
        <div className={`grid flex-1 ${gridCols} gap-2 overflow-auto p-3`}>
          {livekitPeers.map((peer) => (
            <LiveKitTile key={peer.identity} peer={peer} />
          ))}
          {livekitPeers.length === 0 && joined && (
            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 px-4 py-8 text-center">
              <p className="text-sm text-white/40">Ждём участников…</p>
            </div>
          )}
        </div>
      ) : (
        <div className={`grid flex-1 ${gridCols} gap-2 overflow-auto p-3`}>
          <div className="relative min-h-[160px] overflow-hidden rounded-2xl bg-slate-800/60">
            {withVideo ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-xl font-semibold">
                  {(user?.name ?? user?.email ?? 'Я').slice(0, 2).toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-[11px]">
              Вы {!micOn && '🔇'}
            </div>
          </div>

          {peers.map((peer) => {
            const fallbackId = peer.userId.slice(0, 8);
            const name =
              peer.displayName !== fallbackId
                ? peer.displayName
                : memberMap[peer.userId]?.name ||
                  memberMap[peer.userId]?.email?.split('@')[0] ||
                  peer.displayName;
            return (
              <div
                key={peer.userId}
                className="relative min-h-[160px] overflow-hidden rounded-2xl bg-slate-800/60"
              >
                {peer.stream ? (
                  <video
                    ref={(el) => {
                      if (el) remoteVideoRefs.current.set(peer.userId, el);
                      else remoteVideoRefs.current.delete(peer.userId);
                    }}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-600 text-xl font-semibold">
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-[11px]">
                  {name}
                  <span
                    className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${
                      peer.connectionState === 'connected'
                        ? 'bg-emerald-400'
                        : peer.connectionState === 'connecting'
                          ? 'bg-amber-400'
                          : 'bg-red-400'
                    }`}
                  />
                </div>
              </div>
            );
          })}

          {peers.length === 0 && joined && (
            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 px-4 py-8 text-center">
              <p className="text-sm text-white/40">Ждём участников…</p>
              <p className="mt-1 text-xs text-white/25">Откройте групповой звонок в той же комнате</p>
            </div>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center justify-center gap-4 border-t border-white/10 bg-black/30 px-6 py-5">
        <button
          type="button"
          onClick={handleToggleMic}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 ${
            micOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500/30 ring-1 ring-red-500/60'
          }`}
          title={micOn ? 'Выключить микрофон' : 'Включить микрофон'}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            {micOn ? (
              <path
                d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M1 1l22 22M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>

        {joined && (
          <button
            type="button"
            onClick={() => void handleScreenShare()}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 ${
              screenSharing
                ? 'bg-indigo-500/40 ring-1 ring-indigo-400 text-indigo-200'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            title={screenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>
        )}

        {withVideo && (
          <button
            type="button"
            onClick={handleToggleCamera}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 ${
              camOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500/30 ring-1 ring-red-500/60'
            }`}
            title={camOn ? 'Выключить камеру' : 'Включить камеру'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M23 7l-7 5 7 5V7zM1 5h15a2 2 0 012 2v10a2 2 0 01-2 2H1a2 2 0 01-2-2V7a2 2 0 012-2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={handleLeave}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all hover:bg-red-400 active:scale-95"
          title="Покинуть звонок"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </button>
      </div>
    </main>
  );
}

export default function GroupCallPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#080d1a] text-sm text-white/60">
          Загрузка…
        </main>
      }
    >
      <GroupCallInner />
    </Suspense>
  );
}
