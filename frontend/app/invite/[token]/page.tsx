'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../../store/auth';
import { api } from '../../../lib/api';

interface InviteInfo {
  id: string;
  expiresAt: string;
  fromUser: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
    memberSince: string;
  };
  isAdminInvite?: boolean;
}

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() || '')
      .slice(0, 2)
      .join('');
  }
  return email[0]?.toUpperCase() || '?';
}

const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-blue-500',
];

function getGradient(str: string): string {
  let n = 0;
  for (let i = 0; i < str.length; i++) n += str.charCodeAt(i);
  return GRADIENTS[Math.abs(n) % GRADIENTS.length];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

type PageState =
  | { stage: 'loading-info' }
  | { stage: 'ready'; info: InviteInfo }
  | { stage: 'accepting'; info: InviteInfo }
  | { stage: 'success'; contactId?: string }
  | { stage: 'error'; message: string };

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<PageState>({ stage: 'loading-info' });

  useEffect(() => {
    if (!token) {
      setState({ stage: 'error', message: 'Неверная ссылка приглашения' });
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    fetch(`${API_URL}/connections/invite-info?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setState({
            stage: 'error',
            message: data?.message || 'Приглашение недействительно или истекло',
          });
          return;
        }
        setState({ stage: 'ready', info: data.invite });
      })
      .catch(() => {
        setState({ stage: 'error', message: 'Не удалось загрузить приглашение' });
      });
  }, [token]);

  const handleAccept = async () => {
    // Если не залогинен — предлагаем зарегистрироваться или войти
    if (!user) {
      const registerUrl = `/auth/register?invite=${encodeURIComponent(token)}`;
      router.push(registerUrl);
      return;
    }

    if (state.stage !== 'ready') return;

    setState({ stage: 'accepting', info: state.info });

    try {
      const res = await api<{
        ok: boolean;
        contact?: { id: string; email: string; name: string | null };
        message?: string;
      }>('/connections/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        setState({ stage: 'success', contactId: res.contact?.id });
        setTimeout(() => {
          const select = res.contact?.id ? `?select=${res.contact.id}` : '';
          router.replace(`/dashboard${select}`);
        }, 2000);
      } else {
        setState({
          stage: 'error',
          message: res.message || 'Не удалось принять приглашение',
        });
      }
    } catch (err) {
      setState({
        stage: 'error',
        message: err instanceof Error ? err.message : 'Произошла ошибка',
      });
    }
  };

  const info =
    state.stage === 'ready' || state.stage === 'accepting' ? state.info : null;

  return (
    <main className="min-h-screen bg-[#070d1a] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[#070d1a]">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-[100px] pointer-events-none" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-white/40 text-sm font-medium tracking-[0.3em] uppercase">
            C O N N E X Y
          </span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          {state.stage === 'loading-info' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-white/50 text-sm">Загрузка приглашения...</p>
            </div>
          )}

          {(state.stage === 'ready' || state.stage === 'accepting') && info && (() => {
            const { fromUser, expiresAt } = info;
            const gradient = getGradient(fromUser.email);
            const initials = getInitials(fromUser.name, fromUser.email);
            const isAdminInvite = info.isAdminInvite === true;
            const isAccepting = state.stage === 'accepting';

            return (
              <div className="flex flex-col items-center text-center gap-6">
                <div className="relative">
                  {isAdminInvite ? (
                    <div
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-violet-600
                      flex items-center justify-center ring-2 ring-white/10"
                    >
                      <img src="/connexy_favicon.svg" alt="Connexy" className="w-10 h-10" />
                    </div>
                  ) : fromUser.avatarUrl ? (
                    <img
                      src={fromUser.avatarUrl}
                      alt={fromUser.name || fromUser.email}
                      className="w-20 h-20 rounded-full object-cover ring-2 ring-white/10"
                    />
                  ) : (
                    <div
                      className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradient}
                        flex items-center justify-center text-white text-2xl font-bold
                        ring-2 ring-white/10`}
                    >
                      {initials}
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-[#070d1a]" />
                </div>

                <div>
                  <h1 className="text-white text-xl font-semibold">
                    {isAdminInvite
                      ? 'Connexy приглашает тебя'
                      : fromUser.name
                        ? `${fromUser.name} приглашает тебя`
                        : 'Тебя приглашают'}
                  </h1>
                  <p className="text-white/50 text-sm mt-1">
                    присоединиться к приватному чату в Connexy
                  </p>
                </div>

                <div className="w-full bg-white/5 border border-white/8 rounded-xl p-4 text-left">
                  <div className="flex items-center gap-3">
                    {isAdminInvite ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                        <img src="/connexy_favicon.svg" alt="Connexy" className="w-5 h-5" />
                      </div>
                    ) : fromUser.avatarUrl ? (
                      <img
                        src={fromUser.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient}
                          flex items-center justify-center text-white text-sm font-bold`}
                      >
                        {initials}
                      </div>
                    )}
                    <div>
                      <p className="text-white text-sm font-medium">
                        {isAdminInvite ? 'Connexy' : (fromUser.name || fromUser.email)}
                      </p>
                      <p className="text-white/40 text-xs">
                        {isAdminInvite
                          ? 'Приватная платформа для общения'
                          : `На платформе с ${formatMemberSince(fromUser.memberSince)}`}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="w-full py-3 px-6 rounded-xl font-medium text-white
                    bg-gradient-to-r from-blue-600 to-violet-600
                    hover:from-blue-500 hover:to-violet-500
                    disabled:opacity-60 disabled:cursor-not-allowed
                    transition-all duration-200 active:scale-[0.98]"
                >
                  {isAccepting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Принимаем...
                    </span>
                  ) : user ? (
                    'Принять приглашение'
                  ) : (
                    'Создать аккаунт и принять'
                  )}
                </button>

                <p className="text-white/30 text-xs">
                  Ссылка действительна до {formatDate(expiresAt)}
                </p>
              </div>
            );
          })()}

          {state.stage === 'success' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div
                className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30
                flex items-center justify-center"
              >
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-white text-lg font-semibold">Готово!</h2>
                <p className="text-white/50 text-sm mt-1">Контакт добавлен. Переходим в чат...</p>
              </div>
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {state.stage === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div
                className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30
                flex items-center justify-center"
              >
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-white text-lg font-semibold">Не получилось</h2>
                <p className="text-white/50 text-sm mt-1">{state.message}</p>
              </div>
              <div className="flex gap-3 mt-2">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm transition-colors"
                >
                  На главную
                </Link>
                <Link
                  href="/auth/login"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
                >
                  Войти
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-white/20 text-xs mt-6">Connexy · Приватное общение</p>
      </div>
    </main>
  );
}
