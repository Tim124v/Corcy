'use client';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0f1e] px-6 text-center">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[22px] bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
            fill="white"
            opacity="0.9"
          />
        </svg>
      </div>

      <h1 className="mb-3 text-2xl font-semibold text-white">
        Нет подключения
      </h1>

      <p className="mb-8 max-w-xs text-sm leading-relaxed text-slate-400">
        Connexy требует интернет-соединения. Проверьте сеть и попробуйте снова.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-indigo-500 active:scale-95"
      >
        Повторить попытку
      </button>

      <p className="mt-8 text-xs text-slate-600">
        connexy · private · secure
      </p>
    </main>
  );
}

