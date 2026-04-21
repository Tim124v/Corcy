'use client';

import { useLanguage } from '../language-provider';

type AccountStatus = 'online' | 'offline' | 'connected';

type AccountStatusCardProps = {
  onThemeToggle?: () => void;
  onRefresh?: () => void;
  status?: AccountStatus;
  onStatusChange?: (status: AccountStatus) => void;
};

const statusMap: Record<AccountStatus, { label: string; classes: string }> = {
  online: { label: 'Онлайн', classes: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' },
  offline: { label: 'Оффлайн', classes: 'border-slate-500/20 bg-slate-500/10 text-slate-300' },
  connected: { label: 'Подключено', classes: 'border-blue-500/20 bg-blue-500/10 text-blue-300' },
};

export function AccountStatusCard({ onThemeToggle, onRefresh, status = 'online', onStatusChange }: AccountStatusCardProps) {
  const currentStatus = statusMap[status];
  const { language } = useLanguage();

  return (
    <section className="app-shell-card rounded-[24px] p-6 dark:border-slate-700/60">
      <h2 className="mb-4 text-lg font-semibold text-slate-950 dark:text-white">{language === 'en' ? 'Account Status' : 'Статус аккаунта'}</h2>
      <div className="flex items-center justify-between gap-3">
        <select
          value={status}
          onChange={(e) => onStatusChange?.(e.target.value as AccountStatus)}
          className={`rounded-xl border px-3 py-2 text-sm font-medium outline-none ${currentStatus.classes}`}
        >
          <option value="online">{language === 'en' ? 'Online' : 'Онлайн'}</option>
          <option value="offline">{language === 'en' ? 'Offline' : 'Оффлайн'}</option>
          <option value="connected">{language === 'en' ? 'Connected' : 'Подключено'}</option>
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={onThemeToggle} className="rounded-xl border border-slate-200 bg-white/75 p-2.5 text-slate-600 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.1]" title="Тема" aria-label="Тема">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          </button>
          <button type="button" onClick={onRefresh} className="rounded-xl border border-slate-200 bg-white/75 p-2.5 text-slate-600 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.1]" title="Обновить" aria-label="Обновить">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>
    </section>
  );
}
