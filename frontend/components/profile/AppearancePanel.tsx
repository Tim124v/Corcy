'use client';

import { useState, useEffect } from 'react';
import { useLanguage, type AppLanguage } from '../language-provider';
import type { NotificationCategorySettings, NotificationType } from '../../store/notifications';

const STORAGE_ACCENT = 'connexy-accent';

type AppearancePanelProps = {
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
  notificationsEnabled?: boolean;
  onNotificationsToggle?: (enabled: boolean) => void;
  notificationCategoryEnabled?: NotificationCategorySettings;
  onNotificationCategoryToggle?: (type: NotificationType, enabled: boolean) => void;
};

const accents = [
  { id: 'blue', label: 'Синий', class: 'bg-blue-500' },
  { id: 'purple', label: 'Фиолетовый', class: 'bg-purple-500' },
  { id: 'green', label: 'Зелёный', class: 'bg-emerald-500' },
  { id: 'orange', label: 'Оранжевый', class: 'bg-orange-500' },
  { id: 'red', label: 'Красный', class: 'bg-red-500' },
];

const languages = [
  { id: 'ru', label: 'Русский (RU)' },
  { id: 'en', label: 'English (EN)' },
];

const notificationCategories: Array<{ id: NotificationType; title: { ru: string; en: string }; description: { ru: string; en: string } }> = [
  {
    id: 'room',
    title: { ru: 'Комнаты', en: 'Rooms' },
    description: { ru: 'Создание, удаление и вход в комнаты.', en: 'Room creation, deletion, and joins.' },
  },
  {
    id: 'invite',
    title: { ru: 'Приглашения', en: 'Invites' },
    description: { ru: 'Ссылки приглашений и новые подключения.', en: 'Invite links and new connections.' },
  },
  {
    id: 'security',
    title: { ru: 'Безопасность', en: 'Security' },
    description: { ru: 'Смена пароля и защитные события.', en: 'Password changes and security events.' },
  },
  {
    id: 'system',
    title: { ru: 'Системные', en: 'System' },
    description: { ru: 'Системные уведомления приложения.', en: 'System-level app notifications.' },
  },
];

const notificationCategoryIcons: Record<NotificationType, string> = {
  room: '◌',
  invite: '✦',
  security: '◈',
  system: '◎',
};

const notificationCategoryStyles: Record<NotificationType, { icon: string; bg: string }> = {
  room: {
    icon: 'text-sky-300',
    bg: 'bg-sky-500/12',
  },
  invite: {
    icon: 'text-violet-300',
    bg: 'bg-violet-500/12',
  },
  security: {
    icon: 'text-amber-300',
    bg: 'bg-amber-500/12',
  },
  system: {
    icon: 'text-emerald-300',
    bg: 'bg-emerald-500/12',
  },
};

export function AppearancePanel({
  theme = 'dark',
  onThemeChange,
  notificationsEnabled = true,
  onNotificationsToggle,
  notificationCategoryEnabled = {
    invite: true,
    room: true,
    security: true,
    system: true,
  },
  onNotificationCategoryToggle,
}: AppearancePanelProps) {
  const [accent, setAccent] = useState('blue');
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    const a = localStorage.getItem(STORAGE_ACCENT) || 'blue';
    setAccent(a);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_ACCENT, accent);
  }, [accent]);

  return (
    <section className="app-shell-card rounded-[24px] p-6 dark:border-slate-700/60">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
        <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        {language === 'en' ? 'Appearance' : 'Внешний вид'}
      </h2>

      <div className="space-y-6">
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{language === 'en' ? 'Theme' : 'Тема'}</div>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/70 p-1.5 dark:border-white/10 dark:bg-white/[0.04]">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onThemeChange?.(t)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  theme === t
                    ? 'bg-blue-500/20 text-blue-300 shadow-[0_0_20px_-8px_rgba(59,130,246,0.9)]'
                    : 'text-slate-500 hover:bg-slate-900/5 dark:text-slate-400 dark:hover:bg-white/[0.06]'
                }`}
              >
                {language === 'en' ? (t === 'dark' ? 'Dark' : 'Light') : (t === 'dark' ? 'Тёмная' : 'Светлая')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{language === 'en' ? 'Accent Color' : 'Акцентный цвет'}</div>
          <div className="flex gap-2">
            {accents.map(({ id, label, class: c }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAccent(id)}
                className={`w-9 h-9 rounded-full border-2 transition ${c} ${
                  accent === id ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-blue-400' : 'border-slate-300 hover:opacity-90 dark:border-white/20'
                }`}
                title={label}
              >
                <span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{language === 'en' ? 'Language' : 'Язык'}</div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as AppLanguage)}
            className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
          >
            {languages.map(({ id, label }) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {language === 'en' ? 'Notifications' : 'Уведомления'}
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/72 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {language === 'en' ? 'Allow in-app notifications' : 'Разрешить уведомления в приложении'}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {notificationsEnabled
                  ? language === 'en'
                    ? 'New room, invite, and security events will appear in Connexy.'
                    : 'Новые события комнат, приглашений и безопасности будут появляться в Connexy.'
                  : language === 'en'
                    ? 'New notifications are disabled.'
                    : 'Новые уведомления выключены.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNotificationsToggle?.(!notificationsEnabled)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                notificationsEnabled ? 'bg-blue-500/80' : 'bg-white/10'
              }`}
              aria-pressed={notificationsEnabled}
              aria-label={language === 'en' ? 'Toggle notifications' : 'Переключить уведомления'}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className={`mt-3 space-y-2 transition-opacity ${notificationsEnabled ? 'opacity-100' : 'opacity-60'}`}>
            {notificationCategories.map((category) => {
              const enabled = notificationCategoryEnabled[category.id];
              const categoryStyle = notificationCategoryStyles[category.id];

              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/65 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm ${categoryStyle.bg} ${categoryStyle.icon}`}
                    >
                      {notificationCategoryIcons[category.id]}
                    </span>
                    <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {language === 'en' ? category.title.en : category.title.ru}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {language === 'en' ? category.description.en : category.description.ru}
                    </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!notificationsEnabled}
                    onClick={() => onNotificationCategoryToggle?.(category.id, !enabled)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                      enabled && notificationsEnabled ? 'bg-blue-500/80' : 'bg-white/10'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    aria-pressed={enabled && notificationsEnabled}
                    aria-label={language === 'en' ? `Toggle ${category.title.en}` : `Переключить ${category.title.ru.toLowerCase()}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        enabled && notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
