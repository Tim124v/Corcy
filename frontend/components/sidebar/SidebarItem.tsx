'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';

type SidebarItemProps = {
  icon: LucideIcon;
  label: string;
  path: string;
  badge?: number;
  highlight?: boolean;
};

export function SidebarItem({ icon: Icon, label, path, badge, highlight = false }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === path || (path !== '/' && pathname.startsWith(path));

  return (
    <Link
      href={path}
      className={`
        flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200
        ${isActive
          ? 'bg-gradient-to-r from-blue-500/14 to-indigo-500/12 text-blue-700 dark:text-blue-300 shadow-[0_0_20px_-5px_rgba(59,130,246,0.28)]'
          : highlight
            ? 'bg-gradient-to-r from-blue-500/10 to-indigo-500/8 text-blue-700 dark:text-blue-200 shadow-[0_0_18px_-8px_rgba(96,165,250,0.35)] hover:from-blue-500/14 hover:to-indigo-500/12'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-900/5 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
        }
      `}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
