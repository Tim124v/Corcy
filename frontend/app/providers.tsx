'use client';

import type React from 'react';
import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../store/auth';
import { useIncomingCallStore } from '../store/incoming-call';
import { useGroupCallNotifStore } from '../store/group-call-notification';
import { getSocket } from '../store/socket';
import { ThemeProvider } from '../components/theme-provider';
import { LanguageProvider } from '../components/language-provider';
import { AppLayout } from '../components/layout/AppLayout';
import { SocketProvider } from '../components/socket-provider';
import { PwaRegister } from '../components/pwa-register';
import { IncomingCallToast } from '../components/IncomingCallToast';
import { GroupCallToast } from '../components/GroupCallToast';

export default function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const incomingCall = useIncomingCallStore((s) => s.call);
  const clearIncomingCall = useIncomingCallStore((s) => s.setCall);
  const groupCallNotif = useGroupCallNotifStore((s) => s.notification);
  const clearGroupCallNotif = useGroupCallNotifStore((s) => s.setNotification);

  const handleAcceptCall = useCallback(() => {
    if (!incomingCall) return;
    // offer остаётся в store — на /calls читается из useIncomingCallStore
    router.push(
      `/calls?peerId=${incomingCall.fromUserId}&peerName=${encodeURIComponent(incomingCall.fromName)}&incoming=true&video=${incomingCall.isVideo ? 'true' : 'false'}`,
    );
  }, [incomingCall, router]);

  const handleRejectCall = useCallback(() => {
    if (!incomingCall) return;
    getSocket()?.emit('call:reject', { toUserId: incomingCall.fromUserId });
    clearIncomingCall(null);
  }, [incomingCall, clearIncomingCall]);

  const handleJoinGroupCall = useCallback(() => {
    if (!groupCallNotif) return;
    const name = encodeURIComponent(groupCallNotif.roomName);
    clearGroupCallNotif(null);
    router.push(`/group-call?roomId=${groupCallNotif.roomId}&roomName=${name}&video=false`);
  }, [groupCallNotif, clearGroupCallNotif, router]);
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
        {incomingCall && pathname !== '/calls' && (
          <IncomingCallToast
            fromName={incomingCall.fromName}
            isVideo={incomingCall.isVideo}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
          />
        )}
        {!incomingCall && groupCallNotif && (
          <GroupCallToast
            roomName={groupCallNotif.roomName}
            roomId={groupCallNotif.roomId}
            callerName={groupCallNotif.callerName}
            onJoin={handleJoinGroupCall}
            onDismiss={() => clearGroupCallNotif(null)}
          />
        )}
        <AppLayout>{children}</AppLayout>
      </LanguageProvider>
    </ThemeProvider>
  );
}
