'use client';

import { useEffect } from 'react';

type Props = {
  roomName: string;
  roomId: string;
  callerName: string;
  onJoin: () => void;
  onDismiss: () => void;
};

export function GroupCallToast({ roomName, callerName, onJoin, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 30_000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 z-[9998] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 sm:bottom-24 sm:left-auto sm:right-6 sm:translate-x-0">
      <div className="overflow-hidden rounded-3xl bg-slate-900/95 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
        <div className="h-0.5 w-full animate-pulse bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-lg">
              🎙️
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-violet-400">Групповой звонок</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-white">
                {callerName} в «{roomName}»
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 rounded-full p-1 text-slate-500 transition hover:text-slate-300"
              aria-label="Закрыть"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onJoin}
              className="flex-1 rounded-xl bg-violet-600 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 active:scale-95"
            >
              Присоединиться
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
            >
              Позже
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
