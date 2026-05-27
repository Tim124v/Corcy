'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '../../store/auth';
import { useIncomingCallStore } from '../../store/incoming-call';
import { useWebRTC } from '../../hooks/use-webrtc';
import { getSocket } from '../../store/socket';

type CallState = 'idle' | 'outgoing' | 'incoming' | 'active' | 'ended';

function CallsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const accessToken = useAuthStore((s) => s.accessToken);

  const peerId = params.get('peerId') ?? '';
  const peerName = params.get('peerName') ?? 'Собеседник';
  const isVideo = params.get('video') === 'true';
  const isIncoming = params.get('incoming') === 'true';
  const storedCall = useIncomingCallStore((s) => s.call);
  const clearIncomingCall = useIncomingCallStore((s) => s.setCall);
  const incomingOffer = storedCall?.offer ?? null;

  const [callState, setCallState] = useState<CallState>(isIncoming ? 'incoming' : 'outgoing');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(isVideo);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peerIdRef = useRef(peerId);
  peerIdRef.current = peerId;

  const {
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
  } = useWebRTC({
    onRemoteStream: (stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      setCallState('active');
      if (!durationRef.current) {
        durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      }
    },
    onCallEnded: () => {
      setCallState('ended');
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
      setTimeout(() => router.replace('/dashboard'), 2000);
    },
    onError: (err) => setError(err),
  });

  const attachLocalStream = useCallback(() => {
    const stream = getLocalStream();
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [getLocalStream]);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/');
      return;
    }
    if (!peerId) {
      router.replace('/dashboard');
      return;
    }

    const socket = getSocket();
    if (!socket) return;

    let noAnswerTimer: ReturnType<typeof setTimeout> | null = null;
    if (!isIncoming) {
      noAnswerTimer = setTimeout(() => {
        const s = getSocket();
        s?.emit('call:end', { toUserId: peerId });
        setCallState('ended');
        setError('Нет ответа');
        if (durationRef.current) {
          clearInterval(durationRef.current);
          durationRef.current = null;
        }
        setTimeout(() => router.replace('/dashboard'), 2000);
      }, 45_000);
    }

    const onAnswered = async (data: { fromUserId: string; answer: RTCSessionDescriptionInit }) => {
      if (data.fromUserId !== peerIdRef.current) return;
      if (noAnswerTimer) clearTimeout(noAnswerTimer);
      await setRemoteAnswer(data.answer);
    };

    const onIce = async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      if (data.fromUserId !== peerIdRef.current) return;
      await addIceCandidate(data.candidate);
    };

    const onRejected = () => {
      if (noAnswerTimer) clearTimeout(noAnswerTimer);
      setCallState('ended');
      setError('Звонок отклонён');
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
      setTimeout(() => router.replace('/dashboard'), 2000);
    };

    const onEnded = () => {
      if (noAnswerTimer) clearTimeout(noAnswerTimer);
      setCallState('ended');
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
      setTimeout(() => router.replace('/dashboard'), 2000);
    };

    const onBusy = () => {
      if (noAnswerTimer) clearTimeout(noAnswerTimer);
      setCallState('ended');
      setError('Собеседник занят');
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
      setTimeout(() => router.replace('/dashboard'), 2000);
    };

    socket.on('call:answered', onAnswered);
    socket.on('call:ice-candidate', onIce);
    socket.on('call:rejected', onRejected);
    socket.on('call:ended', onEnded);
    socket.on('call:busy', onBusy);

    return () => {
      if (noAnswerTimer) clearTimeout(noAnswerTimer);
      socket.off('call:answered', onAnswered);
      socket.off('call:ice-candidate', onIce);
      socket.off('call:rejected', onRejected);
      socket.off('call:ended', onEnded);
      socket.off('call:busy', onBusy);
    };
  }, [accessToken, router, setRemoteAnswer, addIceCandidate, isIncoming, peerId]);

  useEffect(() => {
    if (!peerId || !accessToken) return;

    if (isIncoming && incomingOffer) {
      return;
    }

    void (async () => {
      await startCall(peerId, isVideo);
      attachLocalStream();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз при монтировании с peerId из URL
  }, []);

  const handleAnswer = useCallback(async () => {
    if (!incomingOffer) return;
    try {
      await answerCall(peerId, incomingOffer, isVideo);
      attachLocalStream();
      clearIncomingCall(null);
    } catch {
      setError('Ошибка при ответе на звонок');
    }
  }, [peerId, isVideo, incomingOffer, answerCall, attachLocalStream, clearIncomingCall]);

  const handleReject = useCallback(() => {
    const socket = getSocket();
    socket?.emit('call:reject', { toUserId: peerId });
    clearIncomingCall(null);
    endCall();
    router.replace('/dashboard');
  }, [peerId, router, endCall, clearIncomingCall]);

  const handleEnd = useCallback(() => {
    endCall(peerId);
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
    router.replace('/dashboard');
  }, [peerId, endCall, router]);

  const handleToggleMic = useCallback(() => {
    const enabled = toggleMic();
    setMicOn(enabled);
  }, [toggleMic]);

  const handleToggleCam = useCallback(() => {
    const enabled = toggleCamera();
    setCamOn(enabled);
  }, [toggleCamera]);

  const handleScreenShare = useCallback(async () => {
    if (screenSharing) {
      await stopScreenShare();
      setScreenSharing(false);
    } else {
      const ok = await startScreenShare();
      if (ok) setScreenSharing(true);
    }
  }, [screenSharing, startScreenShare, stopScreenShare]);

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const initials = peerName.slice(0, 2).toUpperCase();

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#0a0f1e]">
      {isVideo && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl font-semibold text-white shadow-2xl">
          {initials}
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-white">{peerName}</h1>
          <p className="mt-1 text-sm text-white/60">
            {callState === 'outgoing' && 'Вызов...'}
            {callState === 'incoming' && 'Входящий звонок'}
            {callState === 'active' && formatDuration(duration)}
            {callState === 'ended' && (error || 'Звонок завершён')}
          </p>
        </div>

        {error && callState !== 'ended' && (
          <div className="rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-300">{error}</div>
        )}

        <div className="mt-4 flex items-center gap-4">
          {callState === 'incoming' && (
            <>
              <button
                type="button"
                onClick={handleReject}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all hover:bg-red-400 active:scale-95"
                title="Отклонить"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M19.59 4.41L4.41 19.59"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void handleAnswer()}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all hover:bg-emerald-400 active:scale-95"
                title="Ответить"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </>
          )}

          {(callState === 'active' || callState === 'outgoing') && (
            <>
              <button
                type="button"
                onClick={handleToggleMic}
                className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 ${
                  micOn ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white/10 text-white/40'
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
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleEnd}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all hover:bg-red-400 active:scale-95"
                title="Завершить звонок"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </button>

              {isVideo && (
                <button
                  type="button"
                  onClick={handleToggleCam}
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 ${
                    camOn ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white/10 text-white/40'
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
            </>
          )}
        </div>

        {isVideo && (callState === 'active' || callState === 'outgoing') && (
          <div className="absolute bottom-24 right-6 h-32 w-24 overflow-hidden rounded-xl border border-white/20 shadow-xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    </main>
  );
}

export default function CallsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#0a0f1e] text-white/70">
          Загрузка…
        </main>
      }
    >
      <CallsPageInner />
    </Suspense>
  );
}
