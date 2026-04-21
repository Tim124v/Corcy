'use client';

import { useEffect, useMemo } from 'react';
import { Bell, CheckCheck, Shield, Users, Trash2 } from 'lucide-react';
import { useLanguage } from '../../components/language-provider';
import { useNotificationsStore } from '../../store/notifications';
import { Button } from '../../components/ui/Button';

const formatTime = (date: string, language: 'ru' | 'en') =>
  new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ru-RU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

export default function NotificationsPage() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const items = useNotificationsStore((s) => s.items);
  const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead);
  const clearAll = useNotificationsStore((s) => s.clearAll);

  useEffect(() => {
    if (items.some((item) => !item.read)) {
      markAllAsRead();
    }
  }, [items, markAllAsRead]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const getIcon = (type: string) => {
    if (type === 'security') return Shield;
    if (type === 'invite') return Users;
    return Bell;
  };

  return (
    <main className="app-page-bg min-h-screen text-slate-900 dark:text-slate-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-8 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute right-8 top-10 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
              {isEn ? 'Activity center' : 'Центр активности'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
              {isEn ? 'Notifications' : 'Уведомления'}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {unreadCount > 0
                ? isEn
                  ? `${unreadCount} new notifications`
                  : `Новых уведомлений: ${unreadCount}`
                : isEn
                  ? 'All notifications are read.'
                  : 'Все уведомления прочитаны.'}
            </p>
          </div>

          {items.length > 0 && (
            <Button type="button" variant="secondary" onClick={clearAll} className="rounded-2xl px-4 py-3 text-sm font-medium">
              <Trash2 className="h-4 w-4" />
              {isEn ? 'Clear all' : 'Очистить всё'}
            </Button>
          )}
        </header>

        {items.length === 0 ? (
          <div className="app-empty-state flex min-h-[55vh] flex-col items-center justify-center rounded-[28px] px-6 py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/5 text-slate-700 dark:bg-white/[0.05] dark:text-slate-200">
              <CheckCheck className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              {isEn ? 'No notifications yet' : 'Пока нет уведомлений'}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
              {isEn
                ? 'When new activity appears in Connexy, it will show up here.'
                : 'Когда в Connexy появятся новые события, они будут отображаться здесь.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = getIcon(item.type);

              return (
                <article
                  key={item.id}
                  className="app-soft-panel rounded-[24px] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-28px_rgba(59,130,246,0.25)]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-700 dark:bg-white/[0.06] dark:text-slate-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <h2 className="text-base font-semibold text-slate-950 dark:text-white">{item.title}</h2>
                        <span className="text-xs text-slate-500">{formatTime(item.createdAt, language)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.message}</p>
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
                        <CheckCheck className="h-3.5 w-3.5" />
                        {isEn ? 'Read' : 'Прочитано'}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
