'use client';

type ProfileStatsSocialProps = {
  followers?: number;
  following?: number;
  posts?: number;
  className?: string;
};

export function ProfileStatsSocial({
  followers = 0,
  following = 0,
  posts = 0,
  className = '',
}: ProfileStatsSocialProps) {
  const stats = [
    { label: 'Подписчики', value: followers },
    { label: 'Подписки', value: following },
    { label: 'Публикации', value: posts },
  ];

  return (
    <div className={`flex gap-8 sm:gap-12 ${className}`}>
      {stats.map(({ label, value }) => (
        <button
          type="button"
          key={label}
          className="text-center hover:opacity-80 transition"
        >
          <span className="block text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {value}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
        </button>
      ))}
    </div>
  );
}
