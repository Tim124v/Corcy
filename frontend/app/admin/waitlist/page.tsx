'use client';

import { useEffect, useState, useCallback } from 'react';
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
type Stats = {
  users: { total: number; verified: number };
  rooms: { active: number };
  messages: { total: number };
  connections: { total: number };
  plans: { plan: string; count: number }[];
};
type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  isVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  _count: { connectionsA: number; sentMessages: number };
};
type AuditEntry = {
  id: string;
  userId: string | null;
  action: string;
  ipAddress: string | null;
  severity: string;
  createdAt: string;
  metadata: unknown;
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  invited: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-300 border-red-500/20',
};
const SEV_STYLES: Record<string, string> = {
  LOW: 'text-slate-400',
  MEDIUM: 'text-amber-400',
  HIGH: 'text-orange-400',
  CRITICAL: 'text-red-400',
};

type Tab = 'stats' | 'users' | 'waitlist' | 'audit';

export default function AdminPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [tab, setTab] = useState<Tab>('stats');
  const [message, setMessage] = useState('');

  const [stats, setStats] = useState<Stats | null>(null);

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [wlFilter, setWlFilter] = useState('pending');
  const [wlLoading, setWlLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSeverity, setAuditSeverity] = useState('');

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
    const verifyAdmin = async () => {
      try {
        const me = await api<{ isAdmin?: boolean }>('/users/me');
        if (!me.isAdmin) router.replace('/dashboard');
      } catch {
        router.replace('/dashboard');
      }
    };
    void verifyAdmin();
  }, [hydrated, user, router]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api<Stats>('/admin/stats'));
    } catch {
      /* */
    }
  }, []);

  const loadWaitlist = useCallback(async (status: string) => {
    setWlLoading(true);
    try {
      const data = await api<WaitlistEntry[]>(`/waitlist?status=${status}`);
      setEntries(data);
    } catch {
      /* */
    } finally {
      setWlLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async (q: string) => {
    setUsersLoading(true);
    try {
      const data = await api<{ users: AdminUser[] }>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setUsers(data.users);
    } catch {
      /* */
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async (severity: string) => {
    setAuditLoading(true);
    try {
      const data = await api<{ logs: AuditEntry[] }>(
        `/admin/audit-log?limit=100${severity ? `&severity=${severity}` : ''}`,
      );
      setAuditLogs(data.logs);
    } catch {
      /* */
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.isAdmin) return;
    if (tab === 'stats') void loadStats();
    if (tab === 'waitlist') void loadWaitlist(wlFilter);
    if (tab === 'users') void loadUsers('');
    if (tab === 'audit') void loadAudit('');
  }, [tab, user?.isAdmin, loadStats, loadWaitlist, loadUsers, loadAudit, wlFilter]);

  const sendInviteToWaitlist = async (id: string) => {
    setSendingId(id);
    setMessage('');
    try {
      const res = await api<{ ok: boolean; message?: string }>(`/waitlist/${id}/invite`, { method: 'POST' });
      setMessage(res.message || 'Инвайт отправлен');
      void loadWaitlist(wlFilter);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSendingId(null);
    }
  };

  const rejectWaitlist = async (id: string) => {
    if (!window.confirm('Отклонить заявку?')) return;
    try {
      await api(`/waitlist/${id}/reject`, { method: 'POST' });
      void loadWaitlist(wlFilter);
    } catch {
      /* */
    }
  };

  const changePlan = async (userId: string, plan: string) => {
    try {
      const res = await api<{ ok: boolean }>(`/admin/users/${userId}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        setMessage(`Plan updated → ${plan}`);
        void loadUsers(userSearch);
      }
    } catch {
      /* */
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'stats', label: '📊 Статистика' },
    { id: 'waitlist', label: '⏳ Вейтлист' },
    { id: 'users', label: '👥 Пользователи' },
    { id: 'audit', label: '🔐 Аудит' },
  ];

  if (!user?.isAdmin) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
            <p className="mt-1 text-sm text-slate-400">Connexy · {user.email}</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            ← Назад
          </button>
        </div>

        {message && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {message}
          </div>
        )}

        <div className="mb-6 flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setMessage('');
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === t.id ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'stats' && (
          <div>
            {!stats ? (
              <p className="text-sm text-slate-400">Загрузка…</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { label: 'Всего пользователей', value: stats.users.total },
                  { label: 'Верифицированы', value: stats.users.verified },
                  { label: 'Активные комнаты', value: stats.rooms.active },
                  { label: 'Сообщений', value: stats.messages.total },
                  { label: 'Связей', value: stats.connections.total },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
                    <div className="mt-1 text-xs text-slate-400">{s.label}</div>
                  </div>
                ))}
                <div className="col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:col-span-1">
                  <div className="mb-2 text-xs font-medium text-slate-400">Планы</div>
                  {stats.plans.map((p) => (
                    <div key={p.plan} className="flex justify-between text-sm">
                      <span className="text-slate-300">{p.plan}</span>
                      <span className="font-semibold">{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'waitlist' && (
          <div>
            <div className="mb-4 flex gap-2">
              {['pending', 'invited', 'rejected'].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setWlFilter(s);
                    void loadWaitlist(s);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    wlFilter === s
                      ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                      : 'border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {wlLoading ? (
              <p className="text-sm text-slate-400">Загрузка…</p>
            ) : (
              <div className="space-y-2">
                {entries.length === 0 && <p className="text-sm text-slate-400">Заявок нет.</p>}
                {entries.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{e.email}</span>
                        {e.name && <span className="text-xs text-slate-400">({e.name})</span>}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[e.status]}`}
                        >
                          {e.status}
                        </span>
                      </div>
                      {e.reason && <p className="mt-1 truncate text-xs text-slate-400">{e.reason}</p>}
                      <p className="mt-0.5 text-[10px] text-slate-600">
                        {new Date(e.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    {e.status === 'pending' && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => void sendInviteToWaitlist(e.id)}
                          disabled={sendingId === e.id}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {sendingId === e.id ? '…' : 'Invite'}
                        </button>
                        <button
                          onClick={() => void rejectWaitlist(e.id)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-red-500/50 hover:text-red-400"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void loadUsers(userSearch);
                }}
                placeholder="Поиск по email / имени…"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={() => void loadUsers(userSearch)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Найти
              </button>
            </div>
            {usersLoading ? (
              <p className="text-sm text-slate-400">Загрузка…</p>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{u.email}</span>
                        {u.name && <span className="text-xs text-slate-400">{u.name}</span>}
                        {u.isAdmin && (
                          <span className="rounded-full border border-violet-500/30 bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300">
                            admin
                          </span>
                        )}
                        {!u.isVerified && (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
                            unverified
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {u._count.sentMessages} сообщений · {u._count.connectionsA} связей ·{' '}
                        {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <select
                      value={u.plan}
                      onChange={(e) => void changePlan(u.id, e.target.value)}
                      className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {['FREE', 'PRO', 'TEAM'].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div>
            <div className="mb-4 flex gap-2">
              {['', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <button
                  key={s || 'all'}
                  onClick={() => {
                    setAuditSeverity(s);
                    void loadAudit(s);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    auditSeverity === s
                      ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                      : 'border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s || 'Все'}
                </button>
              ))}
            </div>
            {auditLoading ? (
              <p className="text-sm text-slate-400">Загрузка…</p>
            ) : (
              <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
                {auditLogs.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/60 px-3 py-2"
                  >
                    <span className={`shrink-0 text-xs font-bold ${SEV_STYLES[l.severity] ?? 'text-slate-400'}`}>
                      {l.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-200">{l.action}</span>
                        {l.ipAddress && <span className="text-[10px] text-slate-500">{l.ipAddress}</span>}
                      </div>
                      {l.userId && <p className="text-[10px] text-slate-500">uid: {l.userId}</p>}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-slate-600">
                      {new Date(l.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
