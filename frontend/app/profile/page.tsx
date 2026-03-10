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
  const [accountStatus, setAccountStatus] = useState<'online' | 'offline' | 'connected'>('online');
  /** Локальный черновик: data URL (новое фото), 'remove' (удалить), null (без изменений) */
  const [avatarDraft, setAvatarDraft] = useState<string | null | 'remove'>(null);
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
            api<MessageSummary[]>(`/rooms/${room.id}/messages`, { method: 'GET' }).catch(() => []),
          ),
        ),
        Promise.all(
          connectionsList.map((connection) =>
            api<MessageSummary[]>(`/messages?with=${connection.user.id}`, { method: 'GET' }).catch(() => []),
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
      setAccountStatus(storedStatus === 'offline' || storedStatus === 'connected' ? storedStatus : 'online');
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
    } finally {
      setSaving(false);
    }
  };

  const avatarText = useMemo(() => initials(user?.name, user?.email), [user]);

  const updateAccountStatus = (next: 'online' | 'offline' | 'connected') => {
    if (!user) return;
    setAccountStatus(next);
    localStorage.setItem(`connexy-account-status:${user.id}`, next);
  };

  const setProfilePhotoDraft = (file: File | null) => {
    if (!file) {
      setAvatarDraft(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setAvatarDraft(result);
    };
    reader.readAsDataURL(file);
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
              onEditProfile={() => document.getElementById('profile-edit-card')?.scrollIntoView({ behavior: 'smooth' })}
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

          <div>
            <StatisticsPanel
              rooms={rooms.length}
              members={participantsCount}
              messages={messagesCount}
              invitesSent={invites.length}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <section className="app-shell-card rounded-[24px] p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-950 dark:text-white">{language === 'en' ? 'Account Overview' : 'Обзор аккаунта'}</h2>
              <div className="space-y-3">
                <div className="app-shell-muted rounded-xl px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">Account</div>
                  <div className="mt-2 text-sm text-slate-800 dark:text-slate-200">{user.email}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {userProfile?.createdAt
                      ? language === 'en'
                        ? `Joined ${new Date(userProfile.createdAt).toLocaleDateString('en-US')}`
                        : `С нами с ${new Date(userProfile.createdAt).toLocaleDateString('ru-RU')}`
                      : language === 'en'
                      ? 'Account information'
                      : 'Информация аккаунта'}
                  </div>
                </div>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-[0_18px_40px_-18px_rgba(59,130,246,0.95)] transition hover:brightness-110"
                >
                  {language === 'en' ? 'Open settings' : 'Открыть настройки'}
                </Link>
              </div>
            </section>

            <div className="space-y-6">
            <section id="profile-edit-card" className="app-shell-card rounded-[24px] p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Edit Profile</h2>
                <button
                  onClick={() => logout()}
                  className="text-sm font-medium text-rose-300 transition hover:text-rose-200"
                >
                  {language === 'en' ? 'Log out' : 'Выйти'}
                </button>
              </div>
              <form onSubmit={save} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm text-slate-600 dark:text-slate-300">{language === 'en' ? 'Profile photo' : 'Фото профиля'}</label>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white/85 dark:border-white/10 dark:bg-white/[0.04]">
                      {displayAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={displayAvatar} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">{avatarText}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]">
                        {language === 'en' ? 'Upload photo' : 'Загрузить фото'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setProfilePhotoDraft(e.target.files?.[0] || null)}
                        />
                      </label>
                      {canRemoveAvatar && (
                        <button
                          type="button"
                          onClick={() => setAvatarDraft('remove')}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.08]"
                        >
                          {language === 'en' ? 'Remove photo' : 'Удалить фото'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm text-slate-600 dark:text-slate-300">{language === 'en' ? 'Profile name' : 'Имя профиля'}</label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/30"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={language === 'en' ? 'Name' : 'Имя'}
                  />
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Account</div>
                  <div className="mt-2 text-sm text-slate-200">{user.email}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {userProfile?.createdAt
                      ? language === 'en'
                        ? `Joined ${new Date(userProfile.createdAt).toLocaleDateString('en-US')}`
                        : `С нами с ${new Date(userProfile.createdAt).toLocaleDateString('ru-RU')}`
                      : language === 'en'
                      ? 'Account information'
                      : 'Информация аккаунта'}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-[0_18px_40px_-18px_rgba(59,130,246,0.95)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? (language === 'en' ? 'Saving...' : 'Сохранение...') : (language === 'en' ? 'Save changes' : 'Сохранить изменения')}
                </button>
              </form>
            </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
