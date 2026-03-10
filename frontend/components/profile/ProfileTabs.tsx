'use client';

export type ProfileTabId = 'posts' | 'media' | 'likes';

type ProfileTabsProps = {
  activeTab: ProfileTabId;
  onTabChange: (tab: ProfileTabId) => void;
  className?: string;
};

const tabs: { id: ProfileTabId; label: string }[] = [
  { id: 'posts', label: 'Публикации' },
  { id: 'media', label: 'Медиа' },
  { id: 'likes', label: 'Нравится' },
];

export function ProfileTabs({ activeTab, onTabChange, className = '' }: ProfileTabsProps) {
  return (
    <nav className={`border-b border-white/10 dark:border-slate-600/50 ${className}`} aria-label="Профиль">
      <div className="flex gap-6">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`py-3 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
