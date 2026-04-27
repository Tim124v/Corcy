'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth';
import { api } from '../../../lib/api';

type WaitlistEntry = {
  id: string;
  email: string;
  name: string | null;
  reason: string | null;
  status: 'pending' | 'invited' | 'rejected';
  createdAt: string;
};

type Stats = { total: number; pending: number; invited: number };

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  invited: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-300 border-red-500/20',
};

export default function AdminWaitlistPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    if (!user.isAdmin) {
      router.replace('/dashboard');
      return;
    }
  }, [hydrated, user, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        api<WaitlistEntry[]>(`/waitlist?status=${filter}`),
        api<Stats>('/waitlist/stats'),
      ]);
      setEntries(Array.isArray(list) ? list : []);
      setStats(s);
    } catch {
      setEntries([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.isAdmin) void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user]);

  const sendInvite = async (id: string, email: string) => {
    setSendingId(id);
    setMessage('');
    try {
      const res = await api<{ ok: boolean; message?: string }>(`/waitlist/${id}/invite`, { method: 'POST' });
      if (res.ok) {
        setMessage(`✓ Invite sent to ${email}`);
        void loadData();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error sending invite');
    } finally {
      setSendingId(null);
    }
  };

  if (!hydrated || !user?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#070d1a] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <button onClick={() => router.push('/dashboard')} className="transition-colors hover:text-slate-300">
                ← Dashboard
              </button>
              <span>/</span>
              <span className="text-slate-300">Waitlist</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Waitlist Management</h1>
            <p className="mt-1 text-sm text-slate-400">Review and approve access requests</p>
          </div>
          <button
            onClick={() => void loadData()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        {stats && (
          <div className="mb-6 grid grid-cols-3 gap-4">
            {[
              { label: 'Total', value: stats.total, color: 'text-white' },
              { label: 'Pending', value: stats.pending, color: 'text-amber-300' },
              { label: 'Invited', value: stats.invited, color: 'text-emerald-300' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-center">
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-4 flex gap-2">
          {['pending', 'invited', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f === 'all' ? '' : f)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                (f === 'all' ? filter === '' : filter === f)
                  ? 'bg-blue-600 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {message && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] py-16 text-center">
            <p className="text-slate-500">No entries found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition-colors hover:border-white/15"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-white">{entry.name || 'No name'}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_STYLES[entry.status]}`}
                      >
                        {entry.status}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-400">{entry.email}</p>
                    {entry.reason && (
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">"{entry.reason}"</p>
                    )}
                    <p className="mt-2 text-[11px] text-slate-600">
                      {new Date(entry.createdAt).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {entry.status === 'pending' && (
                    <button
                      onClick={() => void sendInvite(entry.id, entry.email)}
                      disabled={sendingId === entry.id}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white transition-all duration-200 hover:from-blue-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sendingId === entry.id ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                          Sending...
                        </span>
                      ) : (
                        'Send Invite →'
                      )}
                    </button>
                  )}

                  {entry.status === 'invited' && (
                    <span className="shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">
                      ✓ Invited
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

