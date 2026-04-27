import { useMemo } from 'react';
import { cn } from '../../lib/utils';

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-fuchsia-600',
  'bg-teal-600',
  'bg-orange-600',
  'bg-indigo-600',
];

function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
}

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-2xl',
};

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  online?: boolean;
  className?: string;
}

export function Avatar({ name, src, size = 'md', online, className }: AvatarProps) {
  const display = name?.trim() || '?';
  const colorClass = useMemo(() => AVATAR_COLORS[getColorIndex(display)], [display]);
  const initials = useMemo(() => {
    const parts = display.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return display.charAt(0).toUpperCase();
  }, [display]);

  return (
    <div className={cn('relative flex-shrink-0 rounded-full', className)}>
      {src ? (
        <div className={cn('w-full h-full rounded-full overflow-hidden')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={display} className="w-full h-full object-cover rounded-full" />
        </div>
      ) : (
        <div
          className={cn(
            SIZE_CLASSES[size],
            colorClass,
            'rounded-full flex items-center justify-center font-semibold text-white select-none',
          )}
          title={display}
        >
          {initials}
        </div>
      )}

      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0f172a]',
            online ? 'bg-emerald-500' : 'bg-slate-500',
          )}
        />
      )}
    </div>
  );
}

