'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { useLanguage } from '../../components/language-provider';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';

type Connection = {
  id: string;
  user: { id: string; email: string; name: string | null; avatarUrl?: string | null };
};

type IncomingRequest = {
  id: string;
  fromUser: { id: string; email: string; name: string | null; avatarUrl?: string | null };
  createdAt: string;
};

const initials = (name?: string | null, email?: string) => {
  if (name && name.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join('');
  }

  return email?.[0]?.toUpperCase() || '?';
};

export default function ContactsPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [connections, setConnections] = useState<Connection[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Connection | null>(null);
  const [addUserId, setAddUserId] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<string>('');
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/');
      return;
    }

    setLoading(true);
    setLoadingRequests(true);
    api<Connection[]>('/connections', { method: 'GET' })
      .then(setConnections)
      .catch(() => setConnections([]))
      .finally(() => setLoading(false));
    api<IncomingRequest[]>('/connections/requests', { method: 'GET' })
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoadingRequests(false));
  }, [accessToken, router]);

  const filteredConnections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return connections;

    return connections.filter((connection) => {
      const name = connection.user.name?.toLowerCase() || '';
      const email = connection.user.email.toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [connections, search]);

  const removeConnection = async (connectionId: string) => {
    setDeletingId(connectionId);
    try {
      await api(`/connections/${connectionId}`, { method: 'DELETE' });
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    } finally {
      setDeletingId(null);
    }
  };

  const addContactById = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = addUserId.trim();
    if (!id) return;
    setAdding(true);
    setAddMessage('');
    try {
      const res = await api<{ ok: boolean; message?: string }>(`/connections/add-by-id`, {
        method: 'POST',
        body: JSON.stringify({ userId: id }),
      });
      if (res?.ok) {
        setAddUserId('');
        setAddMessage(isEn ? 'Request sent.' : 'Заявка отправлена.');
      } else {
        setAddMessage((res as { error?: string })?.error || (isEn ? 'Failed to send request' : 'Не удалось отправить заявку'));
      }
    } catch (err) {
      setAddMessage(err instanceof Error ? err.message : (isEn ? 'Failed to send request' : 'Не удалось отправить заявку'));
    } finally {
      setAdding(false);
    }
  };

  const acceptRequest = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      const res = await api<{ ok: boolean; connection?: Connection }>(`/connections/requests/${requestId}/accept`, { method: 'POST' });
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (res?.connection) {
        setConnections((prev) => {
          const exists = prev.some((c) => c.id === res.connection!.id || c.user.id === res.connection!.user.id);
          return exists ? prev : [res.connection!, ...prev];
        });
      }
    } finally {
      setProcessingRequestId(null);
    }
  };

  const rejectRequest = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      await api(`/connections/requests/${requestId}/reject`, { method: 'POST' });
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } finally {
      setProcessingRequestId(null);
    }
  };

  return (
    <main className="app-page-bg min-h-screen text-slate-900 dark:text-slate-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-8 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute right-8 top-10 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <header className="mb-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/dashboard" className="transition hover:text-blue-600 dark:hover:text-blue-300">← {isEn ? 'Chats' : 'Чаты'}</Link>
          <span>/</span>
          <span className="inline-flex items-center gap-2">
            <span>{isEn ? 'Contacts' : 'Контакты'}</span>
            {requests.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 shadow-[0_0_0_1px_rgba(59,130,246,0.26)] dark:bg-blue-500/20 dark:text-blue-200">
                <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.5)]" />
                {isEn ? `${requests.length} pending` : `${requests.length} новых`}
              </span>
            )}
          </span>
        </header>

        <section className="app-shell-card rounded-[28px] p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                {isEn ? 'People' : 'Люди'}
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                {isEn ? 'Contacts' : 'Контакты'}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {isEn
                  ? 'People added through invitations appear here.'
                  : 'Люди, которых вы добавили через приглашения, появляются здесь.'}
              </p>
            </div>

            <div className="w-full max-w-md space-y-3">
              <div className="app-soft-panel rounded-[18px] px-4 py-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isEn ? 'Search contacts' : 'Поиск контактов'}
                  className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-500 outline-none dark:text-white"
                />
              </div>
              <form onSubmit={addContactById} className="app-soft-panel rounded-[18px] px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                    placeholder={isEn ? 'Add by user ID' : 'Добавить по ID пользователя'}
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-500 outline-none dark:text-white"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                  />
                  <Button
                    type="submit"
                    disabled={adding || !addUserId.trim()}
                    loading={adding}
                    size="sm"
                    className="rounded-full px-4 py-2 text-xs font-semibold"
                  >
                    {adding ? (isEn ? 'Adding...' : 'Добавляем...') : (isEn ? 'Add' : 'Добавить')}
                  </Button>
                </div>
                {addMessage && (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{addMessage}</div>
                )}
              </form>
            </div>
          </div>

          {requests.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {isEn ? 'Contact requests' : 'Запросы в контакты'}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="app-soft-panel rounded-[22px] p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {req.fromUser.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={req.fromUser.avatarUrl}
                          alt={req.fromUser.name || req.fromUser.email}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-sm font-semibold text-white">
                          {initials(req.fromUser.name, req.fromUser.email)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold text-slate-950 dark:text-white">
                          {req.fromUser.name || req.fromUser.email}
                        </div>
                        <div className="truncate text-[13px] text-slate-500 dark:text-slate-400">
                          {req.fromUser.email}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={processingRequestId === req.id}
                        onClick={() => void acceptRequest(req.id)}
                        className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
                      >
                        {processingRequestId === req.id ? '...' : isEn ? 'Accept' : 'Принять'}
                      </button>
                      <button
                        type="button"
                        disabled={processingRequestId === req.id}
                        onClick={() => void rejectRequest(req.id)}
                        className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-300 disabled:opacity-60 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
                      >
                        {isEn ? 'Reject' : 'Отклонить'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{isEn ? 'Loading contacts...' : 'Загрузка контактов...'}</p>
          ) : filteredConnections.length === 0 ? (
            <div className="app-empty-state rounded-[24px]">
              <EmptyState
                icon="👥"
                title={isEn ? 'No contacts yet' : 'Контактов пока нет'}
                description={
                  isEn
                    ? 'Create an invite link or send an invite by email to add someone.'
                    : 'Создайте ссылку-приглашение или отправьте приглашение на email — и контакт появится здесь.'
                }
                action={
                  <Button
                    type="button"
                    onClick={() => router.push('/invites')}
                    className="rounded-full px-8"
                  >
                    {isEn ? 'Go to invites' : 'Перейти к приглашениям'}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredConnections.map((connection) => (
                <div
                  key={connection.id}
                  className="app-soft-panel overflow-hidden rounded-[22px] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-28px_rgba(59,130,246,0.32)]"
                >
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <Avatar
                      name={connection.user.name || connection.user.email}
                      src={connection.user.avatarUrl ?? null}
                      size="lg"
                      className="h-12 w-12 shrink-0"
                    />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="max-w-full truncate text-[15px] font-semibold text-slate-950 dark:text-white">
                        {connection.user.name || connection.user.email}
                      </div>
                      <div className="max-w-full truncate text-[13px] text-slate-500 dark:text-slate-400">
                        {connection.user.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDelete(connection);
                      }}
                      disabled={deletingId === connection.id}
                      className="shrink-0 whitespace-nowrap rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/15 disabled:opacity-60 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
                      aria-label={isEn ? 'Remove contact' : 'Удалить контакт'}
                      title={isEn ? 'Remove contact' : 'Удалить контакт'}
                    >
                      {deletingId === connection.id ? (isEn ? '...' : '...') : (isEn ? 'Remove' : 'Удалить')}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard?select=${connection.user.id}`)}
                    className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    {isEn ? 'Open chat' : 'Открыть чат'}
                    <span>→</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm"
            aria-label={isEn ? 'Close dialog' : 'Закрыть окно'}
            onClick={() => setConfirmDelete(null)}
          />
          <section className="app-modal-card relative z-10 w-full max-w-md rounded-[28px] p-6">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                {isEn ? 'Contacts' : 'Контакты'}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {isEn ? 'Remove contact?' : 'Удалить контакт?'}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {isEn
                  ? `This will remove "${confirmDelete.user.name || confirmDelete.user.email}" from your contacts.`
                  : `Контакт «${confirmDelete.user.name || confirmDelete.user.email}» будет удалён из списка.`}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setConfirmDelete(null)}>
                {isEn ? 'Cancel' : 'Отменить'}
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={deletingId === confirmDelete.id}
                onClick={() => void removeConnection(confirmDelete.id).finally(() => setConfirmDelete(null))}
                className="px-4 py-2.5 text-sm font-semibold"
              >
                {deletingId === confirmDelete.id ? (isEn ? 'Removing...' : 'Удаляем...') : (isEn ? 'Remove' : 'Удалить')}
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
