import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', className)}>
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4 select-none">
        {icon}
      </div>
      <h3 className="text-slate-950 dark:text-white font-semibold mb-1.5">{title}</h3>
      {description && (
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs mb-5">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

