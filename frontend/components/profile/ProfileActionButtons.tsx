'use client';

type ProfileActionButtonsProps = {
  onEdit?: () => void;
  onMessage?: () => void;
  isCurrentUser?: boolean;
  className?: string;
};

export function ProfileActionButtons({
  onEdit,
  onMessage,
  isCurrentUser = true,
  className = '',
}: ProfileActionButtonsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {isCurrentUser && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition"
        >
          Редактировать профиль
        </button>
      )}
      {!isCurrentUser && onMessage && (
        <button
          type="button"
          onClick={onMessage}
          className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition"
        >
          Написать
        </button>
      )}
      <button
        type="button"
        className="rounded-xl border border-white/20 dark:border-slate-600 bg-white/10 dark:bg-slate-700/50 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white/20 dark:hover:bg-slate-600/50 transition"
      >
        Ещё
      </button>
    </div>
  );
}
