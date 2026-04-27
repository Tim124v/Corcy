'use client';

import { useLanguage } from '../language-provider';

type StatisticsPanelProps = {
  rooms?: number;
  members?: number;
  messages?: number;
  invitesSent?: number;
};

function MiniChart({ color }: { color: string }) {
  const heights = ['40%', '70%', '50%', '90%', '60%'];
  const opacities = ['opacity-60', 'opacity-80', 'opacity-100', 'opacity-70', 'opacity-60'];
  return (
    <div className={`h-8 w-12 flex items-end gap-0.5 ${color}`}>
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-1.5 bg-current rounded-t ${opacities[i]}`}
          style={{ height: h, minHeight: 4 }}
        />
      ))}
    </div>
  );
}

export function StatisticsPanel({
  rooms = 0,
  members = 0,
  messages = 0,
  invitesSent = 0,
}: StatisticsPanelProps) {
  const { language } = useLanguage();
  const items = [
    { label: language === 'en' ? 'Rooms' : 'Комнаты', value: rooms, color: 'text-blue-500' },
    { label: language === 'en' ? 'Members' : 'Участники', value: members, color: 'text-amber-500' },
    { label: language === 'en' ? 'Messages' : 'Сообщения', value: messages, color: 'text-blue-500' },
    { label: language === 'en' ? 'Invites' : 'Приглашения', value: invitesSent, color: 'text-violet-500' },
  ];

  return (
    <section className="app-shell-card rounded-[24px] p-6 dark:border-slate-700/60">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
        <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 2.31.826 1.37 1.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 2.31-1.37 1.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-2.31-.826-1.37-1.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-2.31 1.37-1.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {language === 'en' ? 'Statistics' : 'Статистика'}
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {items.map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white/75 p-3 sm:p-4 shadow-inner shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.05] dark:shadow-white/5">
            <div className={`mb-2 ${color}`}>
              <MiniChart color={color} />
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-slate-950 tabular-nums dark:text-white">{value}</div>
            <div className="text-[11px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
