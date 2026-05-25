'use client';

import { useEffect, useRef } from 'react';

type Props = {
  fromName: string;
  isVideo: boolean;
  onAccept: () => void;
  onReject: () => void;
};

function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearInterval(timerRef.current);
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      return;
    }

    const playBip = () => {
      try {
        if (!ctxRef.current || ctxRef.current.state === 'closed') {
          ctxRef.current = new AudioContext();
        }
        const ctx = ctxRef.current;
        const freqs = [880, 1100];
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          const t = ctx.currentTime + i * 0.15;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.start(t);
          osc.stop(t + 0.2);
        });
      } catch {
        /* ignore */
      }
    };

    playBip();
    timerRef.current = setInterval(playBip, 2000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [active]);
}

export function IncomingCallToast({ fromName, isVideo, onAccept, onReject }: Props) {
  useRingtone(true);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const pattern = [400, 200, 400, 200, 400];
      navigator.vibrate(pattern);
      const interval = setInterval(() => navigator.vibrate(pattern), 3000);
      return () => {
        clearInterval(interval);
        navigator.vibrate(0);
      };
    }
  }, []);

  const initials = fromName.slice(0, 2).toUpperCase();

  return (
    <div className="fixed bottom-6 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 sm:bottom-8 sm:left-auto sm:right-6 sm:translate-x-0">
      <div className="overflow-hidden rounded-3xl bg-slate-900/95 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
        <div className="h-0.5 w-full animate-pulse bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />

        <div className="flex items-center gap-4 px-5 py-4">
          <div className="relative shrink-0">
            <div className="absolute -inset-1 animate-ping rounded-full bg-indigo-500/30" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-lg">
              {initials}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-indigo-400">
              {isVideo ? '📹 Входящий видеозвонок' : '📞 Входящий звонок'}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">{fromName}</p>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onReject}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition hover:bg-red-500/40 hover:text-red-300 active:scale-95"
              title="Отклонить"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M19.59 4.41L4.41 19.59" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 transition hover:bg-emerald-500/40 hover:text-emerald-300 active:scale-95"
              title="Ответить"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
