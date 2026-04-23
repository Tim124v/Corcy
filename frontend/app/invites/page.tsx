'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { useLanguage } from '../../components/language-provider';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { useNotificationsStore } from '../../store/notifications';

type InviteItem = {
  id: string;
  token: string;
  toEmail: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedById: string | null;
  status: 'active' | 'expired' | 'used' | 'revoked';
  link: string | null;
};

type InviteFilter = 'all' | InviteItem['status'];

const formatDateTime = (value: string, language: 'ru' | 'en') =>
  new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ru-RU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export default function InvitesPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const { language } = useLanguage();
  const addNotification = useNotificationsStore((s) => s.addNotification);
  const isEn = language === 'en';

  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingLink, setCreatingLink] = useState(false);
  const [sendingEmailInvite, setSendingEmailInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [message, setMessage] = useState('');
  const [copyState, setCopyState] = useState<string | null>(null);
  const [filter, setFilter] = useState<InviteFilter>('active');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);

  const loadInvites = async () => {
    try {
      const items = await api<InviteItem[]>('/connections/invites', { method: 'GET' });
      setInvites(items);
    } catch {
      setInvites([]);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      router.replace('/');
      return;
    }

    void loadInvites().finally(() => setLoading(false));
  }, [accessToken, router]);

  const activeInvitesCount = useMemo(
    () => invites.filter((invite) => invite.status === 'active').length,
    [invites],
  );

  const filteredInvites = useMemo(() => {
    let result = filter === 'all' ? invites : invites.filter((invite) => invite.status === filter);
    // Скрываем отозванные если showRevoked = false и фильтр не "revoked"
    if (!showRevoked && filter !== 'revoked') {
      result = result.filter((invite) => invite.status !== 'revoked');
    }
    return result;
  }, [filter, invites, showRevoked]);

  const filterCounts = useMemo(
    () => ({
      all: invites.length,
      active: invites.filter((invite) => invite.status === 'active').length,
      used: invites.filter((invite) => invite.status === 'used').length,
      expired: invites.filter((invite) => invite.status === 'expired').length,
      revoked: invites.filter((invite) => invite.status === 'revoked').length,
    }),
    [invites],
  );

  const filters: Array<{ id: InviteFilter; label: string; count: number }> = [
    { id: 'all', label: isEn ? 'All' : 'Все', count: filterCounts.all },
    { id: 'active', label: isEn ? 'Active' : 'Активные', count: filterCounts.active },
    { id: 'used', label: isEn ? 'Used' : 'Использованные', count: filterCounts.used },
    { id: 'expired', label: isEn ? 'Expired' : 'Истекшие', count: filterCounts.expired },
    { id: 'revoked', label: isEn ? 'Revoked' : 'Отозванные', count: filterCounts.revoked },
  ];

  const createInviteLink = async () => {
    setCreatingLink(true);
    setMessage('');
    try {
      const result = await api<{ ok: boolean; link?: string }>('/connections/invite-link', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (result.link) {
        try {
          await navigator.clipboard?.writeText(result.link);
          setCopyState('created-link');
        } catch {
          setCopyState(null);
        }
      }

      addNotification({
        type: 'invite',
        title: isEn ? 'Invite created' : 'Приглашение создано',
        message: isEn ? 'A new invite link is ready to share.' : 'Новая ссылка приглашения готова к отправке.',
      });
      setMessage(isEn ? 'Invite link created.' : 'Ссылка приглашения создана.');
      await loadInvites();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : isEn ? 'Failed to create invite link' : 'Не удалось создать ссылку приглашения');
    } finally {
      setCreatingLink(false);
    }
  };

  const createEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSendingEmailInvite(true);
    setMessage('');
    try {
      await api('/connections/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      addNotification({
        type: 'invite',
        title: isEn ? 'Email invite sent' : 'Приглашение отправлено',
        message: isEn ? `Invite sent to ${inviteEmail.trim()}.` : `Приглашение отправлено на ${inviteEmail.trim()}.`,
      });
      setInviteEmail('');
      setMessage(isEn ? 'Invitation sent successfully.' : 'Приглашение успешно отправлено.');
      await loadInvites();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : isEn ? 'Failed to send invitation' : 'Не удалось отправить приглашение');
    } finally {
      setSendingEmailInvite(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    setMessage('');
    try {
      await api(`/connections/invites/${inviteId}`, { method: 'DELETE' });
      await loadInvites();
      setMessage(isEn ? 'Invite revoked.' : 'Приглашение отозвано.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : isEn ? 'Failed to revoke invite' : 'Не удалось отозвать приглашение');
    }
  };

  const copyInvite = async (invite: InviteItem) => {
    if (!invite.link) {
      setMessage(
        isEn
          ? 'This invite link was only shown once when created. Create a new link if needed.'
          : 'Ссылка показывалась один раз при создании. При необходимости создайте новую.',
      );
      return;
    }
    try {
      await navigator.clipboard?.writeText(invite.link);
      setCopyState(invite.id);
      window.setTimeout(() => {
        setCopyState((current) => (current === invite.id ? null : current));
      }, 1800);
    } catch {
      setCopyState(null);
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
          <span>{isEn ? 'Invites' : 'Приглашения'}</span>
        </header>

        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <section className="app-shell-card rounded-[24px] p-6">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                {isEn ? 'Invite center' : 'Центр приглашений'}
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                {isEn ? 'Invitations' : 'Приглашения'}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {isEn
                  ? 'Create a shareable invite link or send an invitation to email.'
                  : 'Создавайте ссылку-приглашение или отправляйте приглашение на email.'}
              </p>
            </div>

            <div className="space-y-4">
              <Button
                type="button"
                onClick={() => void createInviteLink()}
                disabled={creatingLink}
                loading={creatingLink}
                fullWidth
                className="rounded-[20px] py-3.5 text-sm font-semibold shadow-[0_18px_40px_-18px_rgba(59,130,246,0.95)]"
              >
                {creatingLink
                  ? isEn ? 'Creating link...' : 'Создаём ссылку...'
                  : isEn ? 'Create invite link' : 'Создать ссылку'}
              </Button>

              <form autoComplete="off" onSubmit={createEmailInvite} className="app-soft-panel space-y-3 rounded-[20px] p-4">
                <input type="text" name="fake-email" autoComplete="username" className="hidden" tabIndex={-1} />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={isEn ? 'Invite by email' : 'Пригласить по email'}
                  autoComplete="off"
                  className="app-input rounded-2xl px-4 py-3 text-sm outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20"
                />
                <Button type="submit" variant="secondary" disabled={sendingEmailInvite} loading={sendingEmailInvite} fullWidth className="rounded-2xl py-3 text-sm font-medium">
                  {sendingEmailInvite
                    ? isEn ? 'Sending...' : 'Отправляем...'
                    : isEn ? 'Send invitation' : 'Отправить приглашение'}
                </Button>
              </form>

              {message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
            </div>
          </section>

          <section className="app-shell-card rounded-[24px] p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  {isEn ? 'History' : 'История'}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                  {isEn ? 'Your invites' : 'Ваши приглашения'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="app-chip rounded-full px-3 py-1 text-xs font-medium">
                  {isEn ? `Active: ${activeInvitesCount}` : `Активно: ${activeInvitesCount}`}
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="flex items-center justify-center w-8 h-8 rounded-full
                    bg-slate-900/5 dark:bg-white/[0.06]
                    hover:bg-slate-900/10 dark:hover:bg-white/10
                    text-slate-500 dark:text-slate-400
                    transition-all duration-200"
                  title={
                    historyOpen
                      ? isEn
                        ? 'Collapse'
                        : 'Свернуть'
                      : isEn
                        ? 'Expand'
                        : 'Развернуть'
                  }
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${historyOpen ? '' : '-rotate-180'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {historyOpen && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="app-soft-panel mb-5 flex flex-wrap gap-2 rounded-[20px] p-1.5">
                  {filters.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                        filter === item.id
                          ? 'bg-blue-500/16 text-blue-700 shadow-[0_0_20px_-10px_rgba(59,130,246,0.45)] dark:text-blue-200'
                          : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                          filter === item.id
                            ? 'bg-white/70 text-slate-900 dark:bg-white/12 dark:text-white'
                            : 'bg-slate-900/5 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
                        }`}
                      >
                        {item.count}
                      </span>
                    </button>
                  ))}
                </div>

                {loading ? (
                  <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {isEn ? 'Loading invites...' : 'Загрузка приглашений...'}
                  </p>
                ) : filteredInvites.length === 0 ? (
                  <div className="app-empty-state rounded-[20px]">
                    <EmptyState
                      icon="🔗"
                      title={
                        filter === 'all'
                          ? isEn
                            ? 'No invites yet'
                            : 'Приглашений пока нет'
                          : isEn
                            ? 'Nothing found'
                            : 'Ничего не найдено'
                      }
                      description={
                        filter === 'all'
                          ? isEn
                            ? 'Create your first invite link or send an invite by email.'
                            : 'Создайте ссылку-приглашение или отправьте приглашение на email.'
                          : isEn
                            ? 'Try switching the filter to see other invitations.'
                            : 'Попробуйте переключить фильтр, чтобы увидеть другие приглашения.'
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredInvites.map((invite) => {
                      const isCopied = copyState === invite.id || copyState === 'created-link';
                      const statusLabel =
                        invite.status === 'active'
                          ? isEn
                            ? 'Active'
                            : 'Активно'
                          : invite.status === 'used'
                            ? isEn
                              ? 'Used'
                              : 'Использовано'
                            : invite.status === 'revoked'
                              ? isEn
                                ? 'Revoked'
                                : 'Отозвано'
                              : isEn
                                ? 'Expired'
                                : 'Истекло';

                      return (
                        <article
                          key={invite.id}
                          className="app-soft-panel rounded-[20px] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-28px_rgba(59,130,246,0.25)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate text-[15px] font-semibold text-slate-950 dark:text-white">
                                  {invite.toEmail || (isEn ? 'Invite link' : 'Ссылка приглашения')}
                                </h3>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    invite.status === 'active'
                                      ? 'bg-emerald-500/10 text-emerald-300'
                                      : invite.status === 'used'
                                        ? 'bg-blue-500/10 text-blue-300'
                                        : invite.status === 'revoked'
                                          ? 'bg-slate-500/15 text-slate-300'
                                          : 'bg-amber-500/10 text-amber-300'
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                              </div>
                              <div className="mt-2 break-all text-xs leading-5 text-slate-500 dark:text-slate-400">
                                {invite.link ??
                                  (isEn
                                    ? 'Link was shown once at creation (not stored).'
                                    : 'Ссылка показывалась один раз при создании и не хранится в списке.')}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                            <span>
                              {isEn ? 'Created' : 'Создано'}: {formatDateTime(invite.createdAt, language)}
                            </span>
                            <span>
                              {isEn ? 'Expires' : 'Истекает'}: {formatDateTime(invite.expiresAt, language)}
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => void copyInvite(invite)}
                              disabled={!invite.link}
                              className={`rounded-xl px-3 py-2 text-xs font-medium ${
                                isCopied
                                  ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 border-emerald-500/20'
                                  : ''
                              }`}
                            >
                              {isCopied ? (isEn ? 'Copied' : 'Скопировано') : isEn ? 'Copy' : 'Копировать'}
                            </Button>
                            {invite.status === 'active' && (
                              <Button
                                type="button"
                                variant="danger"
                                onClick={() => void revokeInvite(invite.id)}
                                className="rounded-xl px-3 py-2 text-xs font-medium"
                              >
                                {isEn ? 'Revoke' : 'Отозвать'}
                              </Button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {filterCounts.revoked > 0 && filter !== 'revoked' && (
                  <button
                    type="button"
                    onClick={() => setShowRevoked((v) => !v)}
                    className="mt-3 w-full rounded-[20px] py-2.5 text-xs font-medium
                      text-slate-500 dark:text-slate-400
                      bg-slate-900/3 dark:bg-white/[0.03]
                      border border-slate-900/5 dark:border-white/[0.06]
                      hover:bg-slate-900/6 dark:hover:bg-white/[0.06]
                      transition-colors duration-200"
                  >
                    {showRevoked
                      ? isEn
                        ? `Hide revoked (${filterCounts.revoked})`
                        : `Скрыть отозванные (${filterCounts.revoked})`
                      : isEn
                        ? `Show revoked (${filterCounts.revoked})`
                        : `Показать отозванные (${filterCounts.revoked})`}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
