'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { useTheme } from '../../components/theme-provider';
import { useLanguage } from '../../components/language-provider';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { AccountStatusCard } from '../../components/profile/AccountStatusCard';
import { StatisticsPanel } from '../../components/profile/StatisticsPanel';
import { setStoredUserAvatar, useCurrentUserAvatar } from '../../hooks/use-current-user-avatar';
import { EditProfilePanel } from '../../components/profile/EditProfilePanel';
import { Button } from '../../components/ui/Button';

const initials = (name?: string | null, email?: string) => {
  if (name && name.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join('');
  }
  if (email) return email[0]?.toUpperCase() || '?';
  return '?';
};

type Room = {
  id: string;
  name: string;
  owner: { id: string; email: string; name: string | null };
  isOwner: boolean;
};

type Connection = {
  id: string;
  user: { id: string; email: string; name: string | null; avatarUrl?: string | null };
};

type InviteItem = {
  id: string;
  usedAt: string | null;
};

type UserProfile = {
  name: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  isVerified: boolean;
};

type MessageSummary = {
  id: string;
};
type ThreadSummaryResponse = { messages: MessageSummary[]; hasMore: boolean; nextCursor?: string };

export default function ProfilePage() {
  const router = useRouter();
  const { user, accessToken, setAuth, logout } = useAuthStore();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { theme, setTheme } = useTheme();
  const { language } = useLanguage();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [messagesCount, setMessagesCount] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [accountStatus, setAccountStatus] = useState<'online' | 'offline'>('online');
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  /** Локальный черновик: data URL (новое фото), 'remove' (удалить), null (без изменений) */
  const [avatarDraft, setAvatarDraft] = useState<string | null | 'remove'>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const profilePhoto = useCurrentUserAvatar(user?.id, user?.avatarUrl);
  /** Для отображения: черновик или сохранённый аватар */
  const displayAvatar = avatarDraft === 'remove' ? null : (avatarDraft ?? profilePhoto);
  const canRemoveAvatar = !!profilePhoto || (avatarDraft !== null && avatarDraft !== 'remove');

  const participantsCount = useMemo(() => {
    const participantIds = new Set<string>();
    connections.forEach((connection) => participantIds.add(connection.user.id));
    rooms.forEach((room) => {
      if (room.owner.id !== user?.id) participantIds.add(room.owner.id);
    });
    return participantIds.size;
  }, [connections, rooms, user?.id]);

  const loadProfileData = async () => {
    if (!accessToken) return;

    try {
      const [me, roomsList, connectionsList, invitesList] = await Promise.all([
        api<UserProfile>('/users/me'),
        api<Room[]>('/rooms').catch(() => []),
        api<Connection[]>('/connections').catch(() => []),
        api<InviteItem[]>('/connections/invites').catch(() => []),
      ]);

      setName(me.name ?? '');
      setUserProfile(me);
      setRooms(roomsList);
      setConnections(connectionsList);
      setInvites(invitesList);

      const [roomThreads, directThreads] = await Promise.all([
        Promise.all(
          roomsList.map((room) =>
            api<ThreadSummaryResponse>(`/rooms/${room.id}/messages`, { method: 'GET' })
              .then((res) => res.messages)
              .catch(() => []),
          ),
        ),
        Promise.all(
          connectionsList.map((connection) =>
            api<ThreadSummaryResponse>(`/messages?with=${connection.user.id}`, { method: 'GET' })
              .then((res) => res.messages)
              .catch(() => []),
          ),
        ),
      ]);

      const totalRoomMessages = roomThreads.reduce((sum, items) => sum + items.length, 0);
      const totalDirectMessages = directThreads.reduce((sum, items) => sum + items.length, 0);
      setMessagesCount(totalRoomMessages + totalDirectMessages);
    } catch {
      router.replace('/');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !accessToken) {
      if (!accessToken) router.replace('/');
      return;
    }
    if (user) {
      const storedStatus = localStorage.getItem(`connexy-account-status:${user.id}`) as 'online' | 'offline' | 'connected' | null;
      setAccountStatus(storedStatus === 'offline' ? 'offline' : 'online');
    }
    void loadProfileData();
  }, [accessToken, router, user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !user) return;
    setSaving(true);
    try {
      const payload: { name?: string | null; avatarUrl?: string | null } = { name: name.trim() || null };
      if (avatarDraft === 'remove') payload.avatarUrl = null;
      else if (avatarDraft !== null) payload.avatarUrl = avatarDraft;
      const updated = await api<{ id: string; email: string; name: string | null; avatarUrl?: string | null }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setAuth(updated, accessToken);
      setStoredUserAvatar(user.id, updated.avatarUrl ?? null);
      setAvatarDraft(null);
      setShowProfileEdit(false);
    } finally {
      setSaving(false);
    }
  };

  const avatarText = useMemo(() => initials(user?.name, user?.email), [user]);

  const updateAccountStatus = (next: 'online' | 'offline' | 'connected') => {
    if (!user) return;
    const normalized: 'online' | 'offline' = next === 'offline' ? 'offline' : 'online';
    setAccountStatus(normalized);
    localStorage.setItem(`connexy-account-status:${user.id}`, normalized);
  };

  const setProfilePhotoDraft = async (file: File | null) => {
    if (!file) {
      setAvatarDraft(null);
      return;
    }

    if (!accessToken) return;

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/users/me/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Upload failed (${res.status})`);
      }

      const data = await (res.json() as Promise<{ avatarUrl: string }>);
      setAvatarDraft(data.avatarUrl);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Avatar upload error:', err);
    } finally {
      setAvatarUploading(false);
    }
  };

  if (!user) return null;

  return (
    <main className="app-page-bg min-h-screen text-slate-900 dark:text-slate-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-8 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute right-8 top-10 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute inset-0 opacity-20 mix-blend-soft-light" style={{ backgroundImage: 'radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.08), transparent 50%), radial-gradient(1px 1px at 80% 0%, rgba(255,255,255,0.05), transparent 50%)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <header className="mb-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="transition hover:text-blue-600 dark:hover:text-blue-300">← {language === 'en' ? 'Chats' : 'Чаты'}</Link>
          <span>/</span>
          <span>{language === 'en' ? 'Profile' : 'Профиль'}</span>
        </header>

        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.4fr,0.78fr]">
            <ProfileHeader
              user={user}
              avatarUrl={profilePhoto}
              roomsCreated={rooms.length}
              members={participantsCount}
              messagesSent={messagesCount}
              onEditProfile={() => setShowProfileEdit(true)}
              onSettingsClick={() => router.push('/settings')}
              onShareClick={() => navigator.clipboard?.writeText(typeof window !== 'undefined' ? `${window.location.origin}/profile` : '')}
            />
            <AccountStatusCard
              onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              onRefresh={() => void loadProfileData()}
              status={accountStatus}
              onStatusChange={updateAccountStatus}
            />
          </div>

          {/* Mobile меню как в Telegram: всё в Профиле */}
          <section className="app-shell-card rounded-[24px] p-4 sm:p-6 lg:hidden">
            <h2 className="mb-4 text-lg font-semibold text-slate-950 dark:text-white">
              {language === 'en' ? 'Menu' : 'Меню'}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => router.push('/rooms')}
                className="app-shell-muted flex items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-white/90 dark:hover:bg-white/[0.06]"
              >
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {language === 'en' ? 'Rooms' : 'Комнаты'}
                </span>
                <span className="text-slate-400">→</span>
              </button>
              <button
                type="button"
                onClick={() => router.push('/invites')}
                className="app-shell-muted flex items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-white/90 dark:hover:bg-white/[0.06]"
              >
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {language === 'en' ? 'Invites' : 'Приглашения'}
                </span>
                <span className="text-slate-400">→</span>
              </button>
              <button
                type="button"
                onClick={() => router.push('/notifications')}
                className="app-shell-muted flex items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-white/90 dark:hover:bg-white/[0.06]"
              >
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {language === 'en' ? 'Notifications' : 'Уведомления'}
                </span>
                <span className="text-slate-400">→</span>
              </button>
              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="app-shell-muted flex items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-white/90 dark:hover:bg-white/[0.06]"
              >
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {language === 'en' ? 'Settings' : 'Настройки'}
                </span>
                <span className="text-slate-400">→</span>
              </button>
              {user.isAdmin && (
                <button
                  type="button"
                  onClick={() => router.push('/admin/waitlist')}
                  className="app-shell-muted flex items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-white/90 dark:hover:bg-white/[0.06] sm:col-span-2"
                >
                  <span className="text-sm font-semibold text-rose-600 dark:text-rose-300">
                    {language === 'en' ? 'Waitlist' : 'Вейтлист'}
                  </span>
                  <span className="text-slate-400">→</span>
                </button>
              )}
            </div>
          </section>

          <div>
            <StatisticsPanel
              rooms={rooms.length}
              members={participantsCount}
              messages={messagesCount}
              invitesSent={invites.length}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <section className="app-shell-card rounded-[24px] p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-950 dark:text-white">{language === 'en' ? 'Account Overview' : 'Обзор аккаунта'}</h2>
              <div className="space-y-3">
                <div className="app-shell-muted rounded-xl px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Аккаунт</div>
                  <div className="mt-2 text-sm text-slate-800 dark:text-slate-200">{user.email}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {userProfile?.createdAt
                      ? language === 'en'
                        ? `Joined ${new Date(userProfile.createdAt).toLocaleDateString('en-US')}`
                        : `С нами с ${new Date(userProfile.createdAt).toLocaleDateString('ru-RU')}`
                      : language === 'en'
                      ? 'Информация аккаунта'
                      : 'Информация аккаунта'}
                  </div>
                </div>
                <Link href="/settings">
                  <Button type="button">
                    {language === 'en' ? 'Open settings' : 'Открыть настройки'}
                  </Button>
                </Link>
              </div>
            </section>

            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowProfileEdit(true)}
                  className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
                >
                  {language === 'en' ? 'Edit profile' : 'Редактировать профиль'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditProfilePanel
        open={showProfileEdit}
        language={language}
        saving={saving || avatarUploading}
        name={name}
        setName={setName}
        userEmail={user.email}
        createdAt={userProfile?.createdAt ?? null}
        displayAvatar={displayAvatar}
        avatarText={avatarText}
        canRemoveAvatar={canRemoveAvatar}
        onClose={() => setShowProfileEdit(false)}
        onLogout={logout}
        onSubmit={save}
        onUploadPhoto={(file) => void setProfilePhotoDraft(file)}
        onRemovePhoto={() => setAvatarDraft('remove')}
      />
    </main>
  );
}
