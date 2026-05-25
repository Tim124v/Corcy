'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { sanitizeRedirect } from '../../../lib/sanitize-redirect';
import { useAuthStore } from '../../../store/auth';
import { initializeE2EKeys } from '../../../hooks/use-e2e';
import { Button } from '../../../components/ui/Button';

function VerifyEmailPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const emailFromQuery = searchParams.get('email') || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!emailFromQuery) {
      router.replace('/auth/register');
    }
  }, [emailFromQuery, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const codeDigits = code.replace(/\D/g, '').slice(0, 6);
    if (codeDigits.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }
    setLoading(true);
    try {
      const res = await api<{
        ok: boolean;
        user?: { id: string; email: string; name: string | null; avatarUrl?: string | null };
        accessToken?: string;
        error?: string;
      }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: emailFromQuery, code: codeDigits }),
      });
      if (!res.ok) {
        setError(res.error || 'Invalid verification code');
        return;
      }
      if (res.user && res.accessToken) {
        setAuth(res.user, res.accessToken);
        if (typeof window !== 'undefined') {
          const pendingPassword = sessionStorage.getItem('connexy-e2e-pending-password');
          if (pendingPassword) {
            void initializeE2EKeys(res.user.id, pendingPassword);
            sessionStorage.removeItem('connexy-e2e-pending-password');
          }
        }
        const raw = typeof window !== 'undefined' ? sessionStorage.getItem('auth_redirect') : null;
        const redirectTo = sanitizeRedirect(raw) || '/dashboard';
        if (raw) sessionStorage.removeItem('auth_redirect');
        router.replace(redirectTo);
        return;
      }
      setError('Не удалось подтвердить email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    setResending(true);
    try {
      const res = await api<{ ok: boolean; error?: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: emailFromQuery }),
      });
      if (!res.ok) {
        setError(res.error || 'Не удалось отправить код');
        return;
      }
      setInfo('Мы отправили новый код. Проверьте почту (и папку «Спам»).');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса');
    } finally {
      setResending(false);
    }
  };

  if (!emailFromQuery) return null;

  return (
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
                ✉️ Подтверждение
              </span>
              <h2 className="text-3xl font-semibold leading-tight text-white">Подтвердите email</h2>
              <p className="text-sm text-slate-400">
                Введите 6-значный код, который мы отправили на вашу почту.
              </p>
              {emailFromQuery && (
                <p className="text-xs text-slate-500 truncate">Отправлено на: {emailFromQuery}</p>
              )}
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-slate-200">Код подтверждения</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-center text-2xl tracking-[0.5em] placeholder:text-slate-500 outline-none ring-0 transition focus:border-blue-400 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              {info && <p className="text-sm text-green-300">{info}</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                loading={loading}
                fullWidth
                className="rounded-xl px-4 py-3 text-sm font-semibold shadow-lg shadow-blue-500/30"
              >
                {loading ? 'Проверяем...' : 'Подтвердить'}
              </Button>
            </form>

            <p className="mt-6 text-sm text-slate-400">
              Не пришёл код?{' '}
              <button
                type="button"
                onClick={resend}
                disabled={resending}
                className="text-blue-200 underline hover:text-white disabled:opacity-60"
              >
                {resending ? 'Отправляем…' : 'Отправить ещё раз'}
              </button>{' '}
              или{' '}
              <Link className="text-blue-200 underline hover:text-white" href="/auth/register">
                зарегистрируйтесь снова
              </Link>
              .
            </p>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}
