'use client';

import { useLanguage } from '../language-provider';

function IconLock() {
  return (
    <svg className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
function IconEnvelope() {
  return (
    <svg className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconKey() {
  return (
    <svg className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}
function IconDevice() {
  return (
    <svg className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

type SecurityPanelProps = {
  isVerified?: boolean;
  twoFaEnabled?: boolean;
  passwordSubtitle?: string;
  sessionsCount?: number;
  onViewAll?: () => void;
  onToggleTwoFactor?: () => void;
  onPasswordClick?: () => void;
  onSessionsClick?: () => void;
};

export function SecurityPanel({
  isVerified = false,
  twoFaEnabled = false,
  passwordSubtitle = 'Not changed yet',
  sessionsCount = 1,
  onViewAll,
  onToggleTwoFactor,
  onPasswordClick,
  onSessionsClick,
}: SecurityPanelProps) {
  const { language } = useLanguage();
  return (
    <section id="security-section" className="app-shell-card rounded-[24px] p-6 dark:border-slate-700/60">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
          <IconLock />
          {language === 'en' ? 'Security' : 'Безопасность'}
        </h2>
        <button type="button" onClick={onViewAll} className="text-sm text-blue-300 hover:underline flex items-center gap-1">
          {language === 'en' ? 'View All' : 'Открыть'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <ul className="space-y-1">
        <li>
          <div className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/72 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-3 min-w-0">
              <IconEnvelope />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{language === 'en' ? 'Email Verified' : 'Email подтверждён'}</div>
              </div>
            </div>
            {isVerified ? (
              <span className="shrink-0 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-300">{language === 'en' ? 'Pending' : 'Ожидает'}</span>
            )}
          </div>
        </li>
        <li>
          <div className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/72 px-4 py-3 text-left opacity-85 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-3 min-w-0">
              <IconLock />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{language === 'en' ? 'Two-Factor Auth' : 'Двухфакторная защита'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'en' ? 'Not implemented yet' : 'Пока не реализовано'}
                </div>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
              {language === 'en' ? 'Soon' : 'Скоро'}
            </span>
          </div>
        </li>
        <li>
          <button
            type="button"
            onClick={onPasswordClick}
            className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/72 px-4 py-3 text-left transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <IconKey />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{language === 'en' ? 'Password' : 'Пароль'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{passwordSubtitle}</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={onSessionsClick}
            className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/72 px-4 py-3 text-left transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <IconDevice />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{language === 'en' ? 'Active Sessions' : 'Активные сессии'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'en'
                    ? `${sessionsCount} ${sessionsCount === 1 ? 'device connected' : 'devices connected'}`
                    : `${sessionsCount} ${sessionsCount === 1 ? 'устройство подключено' : 'устройства подключены'}`}
                </div>
              </div>
            </div>
            <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </li>
      </ul>
    </section>
  );
}
