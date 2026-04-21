export interface MessageStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read';
  className?: string;
}

export function MessageStatus({ status, className = '' }: MessageStatusProps) {
  if (status === 'sending') {
    return (
      <span className={`text-slate-500 text-xs ${className}`} title="Отправляется">
        ○
      </span>
    );
  }

  if (status === 'sent') {
    return (
      <span className={`text-slate-500 text-xs ${className}`} title="Отправлено">
        ✓
      </span>
    );
  }

  if (status === 'delivered') {
    return (
      <span className={`text-slate-400 text-xs ${className}`} title="Доставлено">
        ✓✓
      </span>
    );
  }

  return (
    <span className={`text-blue-500 text-xs ${className}`} title="Прочитано">
      ✓✓
    </span>
  );
}

