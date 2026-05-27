'use client';

import { initials, getAvatarGradient } from './utils';

// ── QuoteBubble ───────────────────────────────────────────────────────────────

export function QuoteBubble({
  replyTo,
  isMine,
  allMessages,
  isEn,
}: {
  replyTo: {
    id: string;
    text: string;
    senderId: string;
    attachmentName?: string | null;
  };
  isMine: boolean;
  allMessages: { id: string; senderId: string }[];
  isEn: boolean;
}) {
  const isReplyMine = allMessages.some(
    (m) => m.id === replyTo.id && m.senderId === replyTo.senderId,
  );
  return (
    <div
      className={`mb-1.5 rounded-xl px-2.5 py-1.5 text-[11px] border-l-2 ${
        isMine
          ? 'border-white/50 bg-white/15 text-white/80'
          : 'border-indigo-400/60 bg-slate-200/60 text-slate-600 dark:bg-slate-600/30 dark:text-slate-300'
      }`}
    >
      <div className="mb-0.5 font-semibold opacity-80">
        {isReplyMine
          ? isEn
            ? 'You'
            : 'Вы'
          : isEn
            ? 'Message'
            : 'Сообщение'}
      </div>
      <div className="truncate leading-tight">
        {replyTo.text ||
          (replyTo.attachmentName ? `📎 ${replyTo.attachmentName}` : '…')}
      </div>
    </div>
  );
}

// ── renderAvatar ──────────────────────────────────────────────────────────────

export const renderAvatar = ({
  name,
  email,
  photo,
  userId,
  className = '',
}: {
  name?: string | null;
  email?: string;
  photo?: string | null;
  userId?: string;
  className?: string;
  textClassName?: string;
}) => {
  const gradient = userId
    ? getAvatarGradient(userId)
    : 'from-slate-500 to-slate-600';
  const fallbackEl = (
    <div
      className={`absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white ${gradient}`}
    >
      {initials(name, email)}
    </div>
  );
  const sizeClass = className.includes('h-') ? '' : 'h-10 w-10';
  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden ${sizeClass} ${className}`}
    >
      {fallbackEl}
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="relative z-10 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
};

