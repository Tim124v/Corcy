'use client';

import Link from 'next/link';

export default function HelpPage() {
  return (
    <main className="app-page-bg min-h-screen px-6 py-10 text-slate-900 dark:text-slate-50">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Помощь</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Это страница помощи Connexy. Здесь можно разместить FAQ, контакты поддержки и советы по безопасности.
        </p>

        <div className="mt-6 rounded-2xl bg-white/80 p-5 text-sm text-slate-700 shadow-[0_12px_24px_-20px_rgba(148,163,184,0.32)] dark:bg-slate-900/50 dark:text-slate-200 dark:shadow-[0_14px_28px_-22px_rgba(0,0,0,0.72)]">
          <div className="font-medium">Быстрые ссылки</div>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <Link className="text-blue-600 hover:underline dark:text-blue-400" href="/dashboard">
                Чаты
              </Link>
            </li>
            <li>
              <Link className="text-blue-600 hover:underline dark:text-blue-400" href="/settings">
                Настройки
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

