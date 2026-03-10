'use client';

type ProfileStatsProps = {
  roomsCreated?: number;
  members?: number;
  messagesSent?: number;
};

const statLabel: Record<string, string> = {
  rooms: 'Комнат создано',
  members: 'Участников',
  messages: 'Сообщений',
};

export function ProfileStats({ roomsCreated = 0, members = 0, messagesSent = 0 }: ProfileStatsProps) {
  const stats = [
    { label: statLabel.rooms, value: roomsCreated },
    { label: statLabel.members, value: members },
    { label: statLabel.messages, value: messagesSent },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mt-6">
      {stats.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-xl border border-white/10 dark:border-slate-600/50 bg-white/5 dark:bg-slate-800/30 backdrop-blur p-4 text-center"
        >
          <div className="text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">{value}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}
