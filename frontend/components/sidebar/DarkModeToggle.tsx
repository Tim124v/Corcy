'use client';

import { Moon } from 'lucide-react';
import { useTheme } from '../../components/theme-provider';
import { useLanguage } from '../language-provider';

type DarkModeToggleProps = {
  className?: string;
};

export function DarkModeToggle({ className = '' }: DarkModeToggleProps) {
  const { theme, toggle } = useTheme();
  const { language } = useLanguage();

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2">
        <Moon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {language === 'en' ? 'Dark Mode' : 'Тёмная тема'}
        </span>
      </div>
      <button
        type="button"
        onClick={toggle}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        role="switch"
        aria-checked={theme === 'dark'}
      >
        <span
          className={`
            absolute inset-0 rounded-full transition-colors
            ${theme === 'dark' ? 'bg-blue-500' : 'bg-slate-600 dark:bg-slate-500'}
          `}
        />
        <span
          className={`
            absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform
            ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
}
