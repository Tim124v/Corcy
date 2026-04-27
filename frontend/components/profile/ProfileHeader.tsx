'use client';

import { useLanguage } from '../language-provider';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

type User = { id: string; email: string; name: string | null };

const initials = (name?: string | null, email?: string) => {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase()).slice(0, 2).join('');
  }
  if (email) return email[0]?.toUpperCase() || '?';
  return '?';
};

function IconFolder() {
  return (
    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
function IconPencil() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

type ProfileHeaderProps = {
  user: User;
  avatarUrl?: string | null;
  roomsCreated: number;
  members?: number;
  messagesSent?: number;
  onEditProfile?: () => void;
  onSettingsClick?: () => void;
  onShareClick?: () => void;
};

export function ProfileHeader({
  user,
  avatarUrl,
  roomsCreated = 0,
  members = 0,
  messagesSent = 0,
  onEditProfile,
  onSettingsClick,
  onShareClick,
}: ProfileHeaderProps) {
  const displayName = user.name?.trim() || 'Без имени';
  const handle = user.email.replace(/@.*$/, '') || 'user';
  const { language } = useLanguage();
  return (
    <header className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] p-6 shadow-[0_28px_90px_-40px_rgba(148,163,184,0.55)] dark:border-slate-700/60 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] dark:shadow-[0_28px_90px_-40px_rgba(15,23,42,0.95)] md:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),transparent_38%,rgba(15,23,42,0.03))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_38%,rgba(255,255,255,0.02))]" />
      <div className="pointer-events-none absolute -left-12 top-8 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="relative shrink-0">
          <Avatar
            name={displayName}
            src={avatarUrl}
            size="xl"
            online
            className="!w-28 !h-28 shadow-[0_0_0_4px_rgba(255,255,255,0.95),0_0_0_8px_rgba(59,130,246,0.18),0_20px_45px_-15px_rgba(59,130,246,0.35)] dark:shadow-[0_0_0_4px_rgba(15,23,42,0.85),0_0_0_8px_rgba(59,130,246,0.35),0_20px_45px_-15px_rgba(59,130,246,0.85)]"
          />
          <span
            className="absolute bottom-2 right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 dark:border-slate-950"
            title="Онлайн"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{displayName}</h1>
            <span className="shrink-0" aria-hidden><IconCheck /></span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur dark:border-white/10 dark:bg-white/8 dark:text-slate-200">
              <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h8m-8 0 2.5 2.5M8 12 10.5 9.5M4 7h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
              </svg>
              {language === 'en' ? 'Premium Member' : 'Премиум'}
            </span>
          </div>
          <p className="mt-1 text-base text-slate-600 dark:text-slate-300">@{handle}.connexy</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{language === 'en' ? 'Your ID' : 'Ваш ID'}</span>
            <code className="rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-1.5 text-[13px] font-mono text-slate-800 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200">{user.id}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(user.id);
              }}
              className="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1]"
              title={language === 'en' ? 'Copy ID' : 'Скопировать ID'}
              aria-label={language === 'en' ? 'Copy ID' : 'Скопировать ID'}
            >
              {language === 'en' ? 'Copy' : 'Копировать'}
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {onEditProfile && (
              <Button type="button" onClick={onEditProfile}>
                <IconPencil />
                {language === 'en' ? 'Edit Profile' : 'Редактировать профиль'}
              </Button>
            )}
            <button type="button" onClick={onSettingsClick} className="rounded-xl border border-slate-200 bg-white/80 p-2.5 text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.1]" title="Настройки" aria-label="Настройки">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 2.31.826 1.37 1.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 2.31-1.37 1.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-2.31-.826-1.37-1.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-2.31 1.37-1.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button type="button" onClick={onShareClick} className="rounded-xl border border-slate-200 bg-white/80 p-2.5 text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.1]" title="Скопировать ссылку на профиль" aria-label="Скопировать ссылку">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </button>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <IconFolder />
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{language === 'en' ? 'Created Rooms' : 'Комнаты'}</div>
                <div className="text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">{roomsCreated}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <IconUsers />
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{language === 'en' ? 'Members' : 'Участники'}</div>
                <div className="text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">{members}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <IconChat />
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{language === 'en' ? 'Messages' : 'Сообщения'}</div>
                <div className="text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">{messagesSent}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
