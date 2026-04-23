'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth';
import { api } from '../../../lib/api';

export default function AdminSetupPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
          email: email.trim(),
          password,
          inviteToken: secret,
        }),
      });

      if (!res.ok) {
        setError(res.error || 'Ошибка регистрации');
        return;
      }

      if (res.needVerification && res.email) {
        router.replace(`/auth/verify-email?email=${encodeURIComponent(res.email)}`);
        return;
      }

      if (res.user && res.accessToken) {
        setAuth(res.user, res.accessToken);
        router.replace('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <p className="text-white/20 text-xs text-center tracking-[0.3em] uppercase mb-8">
          C O N N E X Y
        </p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-white text-lg font-semibold mb-6">Admin Setup</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                text-white placeholder-white/30 outline-none
                focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
            />
            <input
              type="password"
              placeholder="Пароль (минимум 8 символов)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                text-white placeholder-white/30 outline-none
                focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
            />
            <input
              type="password"
              placeholder="Admin secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                text-white placeholder-white/30 outline-none
                focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Создаём...' : 'Создать аккаунт'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

