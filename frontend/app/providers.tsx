'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { ThemeProvider } from '../components/theme-provider';
import { LanguageProvider } from '../components/language-provider';
import { AppLayout } from '../components/layout/AppLayout';
import { SocketProvider } from '../components/socket-provider';

export default function Providers({ children }: { children: React.ReactNode }) {
  const tryRestoreSession = useAuthStore((s) => s.tryRestoreSession);
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    void tryRestoreSession();

    // Защита: если через 5 секунд всё ещё не hydrated — показываем страницу
    // чтобы пользователь не видел бесконечный спиннер при проблемах с сетью
    const timer = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [tryRestoreSession]);

  useEffect(() => {
    const stop = useAuthStore.getState().scheduleRefresh();
    return stop;
  }, [accessToken]);

  if (!hydrated && !timedOut) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SocketProvider />
        <AppLayout>{children}</AppLayout>
      </LanguageProvider>
    </ThemeProvider>
  );
}
