'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { ThemeProvider } from '../components/theme-provider';
import { LanguageProvider } from '../components/language-provider';
import { AppLayout } from '../components/layout/AppLayout';
import { SocketProvider } from '../components/socket-provider';
import { PwaRegister } from '../components/pwa-register';

export default function Providers({ children }: { children: React.ReactNode }) {
  const tryRestoreSession = useAuthStore((s) => s.tryRestoreSession);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void tryRestoreSession();
  }, [tryRestoreSession]);

  // Проактивное обновление access token за 2 минуты до истечения (каждые 13 минут)
  useEffect(() => {
    if (!accessToken) return;

    const refresh = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/refresh`,
          { method: 'POST', credentials: 'include' },
        );
        const data = (await res.json()) as { ok: boolean; accessToken?: string };
        if (data.ok && data.accessToken) {
          setAccessToken(data.accessToken);
        }
      } catch {
        // Сеть недоступна — не логаутим, попробуем в следующий раз
      }
    };

    refreshTimerRef.current = setInterval(refresh, 13 * 60 * 1000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [accessToken, setAccessToken]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <ThemeProvider>
      <LanguageProvider>
        <PwaRegister />
        <SocketProvider />
        <AppLayout>{children}</AppLayout>
      </LanguageProvider>
    </ThemeProvider>
  );
}
