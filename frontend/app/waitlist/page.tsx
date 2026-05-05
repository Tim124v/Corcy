'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

type Step = 'form' | 'success';

export default function WaitlistPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; message?: string; error?: string }>(
        '/waitlist/join',
        {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, reason: reason.trim() || undefined }),
          token: '',
        },
      );
      if (res.ok) {
        setStep('success');
      } else {
        setError(res.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#020617] px-4 py-12">
      {/* Фон */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/8 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Лого */}
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/connexy_icon.svg"
            alt="Connexy"
            width={52}
            height={52}
            className="drop-shadow-[0_0_16px_rgba(99,102,241,0.7)]"
          />
          <div className="text-center">
            <div className="flex flex-col items-center justify-center gap-1">
              <span
                className="text-[22px] font-bold leading-none tracking-[-0.03em]"
                style={{
                  background: 'linear-gradient(180deg, #ffffff 0%, #eef2ff 38%, #a5b4fc 72%, #7c83ff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Corsy
              </span>
              <span className="text-[9px] font-medium uppercase leading-none tracking-[0.08em] text-slate-500 dark:text-white/45">
                Private · Secure
              </span>
            </div>
          </div>
        </div>

        {step === 'form' ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 backdrop-blur-sm">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold text-white">Request Access</h2>
              <p className="mt-2 text-sm text-slate-400">
                Connexy is invite-only. Join the waitlist and we'll reach out when your spot is ready.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                />
              </div>

              {/* Имя */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Your name <span className="text-slate-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex"
                  maxLength={50}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                />
              </div>

              {/* Причина */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Why do you need Connexy? <span className="text-slate-600">(optional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Private team communication, secure client chats..."
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-sm font-semibold text-white hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending...
                  </span>
                ) : (
                  'Request Access →'
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="hover:text-slate-400 transition-colors"
              >
                Already have an account? Sign in
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 backdrop-blur-sm text-center">
            <div className="mb-4 flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-3">You're on the list!</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              We've received your request and sent a confirmation to{' '}
              <span className="text-slate-200">{email}</span>.
              <br /><br />
              We'll review your request and send an invite link when your spot is ready.
            </p>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 p-4 mb-6">
              <p className="text-xs text-violet-300/80">
                🔐 While you wait — Connexy is a private messaging platform with end-to-end encryption. Only the people you choose can reach you.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Back to home
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

