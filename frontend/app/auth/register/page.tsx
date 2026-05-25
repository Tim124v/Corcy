'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { sanitizeRedirect } from '../../../lib/sanitize-redirect';
import { useAuthStore } from '../../../store/auth';
import { SecureInput } from '../../../components/ui/SecureInput';
import { Button } from '../../../components/ui/Button';

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const redirect = searchParams.get('redirect');
  const safeRedirect = sanitizeRedirect(redirect);
  const inviteToken = searchParams.get('invite') || '';
  const [inviteInfo, setInviteInfo] = useState<{
    fromUser?: { name: string | null; email: string; avatarUrl: string | null };
    isBootstrap?: boolean;
  } | null>(null);
  const [inviteChecking, setInviteChecking] = useState(true);
  const [inviteError, setInviteError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const safe = sanitizeRedirect(redirect);
    if (safe && typeof window !== 'undefined') sessionStorage.setItem('auth_redirect', safe);
  }, [redirect]);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    if (!inviteToken) {
      router.replace('/auth/no-invite');
      return;
    }

    fetch(`${API_URL}/auth/check-invite?token=${encodeURIComponent(inviteToken)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setInviteError(data?.error || 'Приглашение недействительно');
          setInviteChecking(false);
          return;
        }
        setInviteInfo({
          fromUser: data.fromUser,
          isBootstrap: data.isBootstrap,
        });
        setInviteChecking(false);
      })
      .catch(() => {
        setInviteError('Не удалось проверить приглашение');
        setInviteChecking(false);
      });
  }, [inviteToken, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const emailTrim = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      setError('Введите корректный email');
      return;
    }
    if (password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      const res = await api<{
        ok: boolean;
        needVerification?: boolean;
        email?: string;
        user?: { id: string; email: string; name: string | null; avatarUrl?: string | null };
        accessToken?: string;
        error?: string;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: emailTrim,
          password,
          confirmPassword,
          name: name.trim() || undefined,
          inviteToken,
        }),
      });
      if (!res.ok) {
        setError(res.error || 'Не удалось зарегистрироваться');
        return;
      }
      if (res.needVerification && res.email) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('connexy-e2e-pending-password', password);
        }
        router.replace(`/auth/verify-email?email=${encodeURIComponent(res.email)}`);
        return;
      }
      if (res.user && res.accessToken) {
        setAuth(res.user, res.accessToken);
        const raw = typeof window !== 'undefined' ? sessionStorage.getItem('auth_redirect') : null;
        const redirectTo = sanitizeRedirect(raw);
        if (raw) sessionStorage.removeItem('auth_redirect');
        router.replace(redirectTo || '/dashboard');
        return;
      }
      setError('Не удалось зарегистрироваться');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Suspense fallback={null}>
      <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-32 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute right-10 top-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-25 mix-blend-soft-light"
            style={{
              backgroundImage:
                'radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.08), transparent 50%), radial-gradient(1px 1px at 80% 0%, rgba(255,255,255,0.06), transparent 50%), radial-gradient(1px 1px at 50% 100%, rgba(255,255,255,0.05), transparent 50%)',
            }}
          />
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-10">
          <div className="w-full max-w-md rounded-3xl border border-white/5 bg-slate-900/70 p-6 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.9)] backdrop-blur sm:p-8">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                🚀 Быстрый старт
              </span>
              <h2 className="text-3xl font-semibold leading-tight text-white">Создайте аккаунт</h2>
              <p className="text-sm text-slate-400">Приглашения, контакты и защищённые чаты в одном месте.</p>
            </div>

            {inviteChecking && (
              <div className="flex items-center gap-2 text-sm text-white/50 mt-5">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Проверяем приглашение...
              </div>
            )}

            {inviteError && (
              <div className="mt-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {inviteError}
                <div className="mt-2">
                  <a href="/auth/no-invite" className="text-red-300 underline text-xs">
                    Узнать как получить приглашение
                  </a>
                </div>
              </div>
            )}

            {inviteInfo?.fromUser && !inviteChecking && (
              <div
                className="mt-5 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15
                flex items-center gap-3"
              >
                {inviteInfo.fromUser.avatarUrl ? (
                  <img
                    src={inviteInfo.fromUser.avatarUrl}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full bg-emerald-500/20 flex-shrink-0
                    flex items-center justify-center text-emerald-400 text-sm font-bold"
                  >
                    {(inviteInfo.fromUser.name || inviteInfo.fromUser.email)[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-emerald-300 text-xs font-medium">Приглашение от</p>
                  <p className="text-white text-sm truncate">
                    {inviteInfo.fromUser.name || inviteInfo.fromUser.email}
                  </p>
                </div>
                <span className="ml-auto text-emerald-400 flex-shrink-0">✓</span>
              </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-slate-200">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 outline-none ring-0 transition focus:border-blue-400 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/40"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-slate-200">Пароль (не менее 8 символов)</label>
                <SecureInput
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 pr-[4.5rem] px-4 py-3 text-white placeholder:text-slate-500 outline-none ring-0 transition focus:border-blue-400 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-slate-200">Подтвердите пароль</label>
                <SecureInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 pr-[4.5rem] px-4 py-3 text-white placeholder:text-slate-500 outline-none ring-0 transition focus:border-blue-400 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-slate-200">Имя (необязательно)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ваше имя"
                  autoComplete="name"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 outline-none ring-0 transition focus:border-blue-400 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button
                type="submit"
                disabled={loading || inviteChecking || !!inviteError}
                loading={loading}
                fullWidth
                className="rounded-xl px-4 py-3 text-sm font-semibold shadow-lg shadow-blue-500/30"
              >
                {loading ? 'Создаём...' : 'Создать аккаунт'}
              </Button>
            </form>

            <p className="mt-6 text-sm text-slate-400">
              Уже есть аккаунт?{' '}
              <Link
                className="text-blue-200 underline decoration-blue-500/60 underline-offset-4 hover:text-white"
                href={safeRedirect ? `/auth/login?redirect=${encodeURIComponent(safeRedirect)}` : '/auth/login'}
              >
                Войти
              </Link>
            </p>
          </div>
        </div>
    </main>
    </Suspense>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  );
}
