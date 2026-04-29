'use client';

import Link from 'next/link';
import { useAuthStore } from '../../store/auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';

export default function CallsPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) router.replace('/');
  }, [accessToken, router]);

  return (
    <main className="app-page-bg min-h-[100dvh] text-slate-900 dark:text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/dashboard" className="transition hover:text-blue-600 dark:hover:text-blue-300">
            ← Чаты
          </Link>
          <span>/</span>
          <span>Звонки</span>
        </header>

        <div className="app-empty-state rounded-[24px] p-6">
          <EmptyState
            icon="📞"
            title="Звонки"
            description="Этот раздел в разработке. Пока можно общаться в чатах и комнатах."
            action={
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button type="button" onClick={() => router.push('/dashboard')} className="rounded-full px-8">
                  Открыть чаты
                </Button>
                <Button type="button" variant="secondary" onClick={() => router.push('/contacts')} className="rounded-full px-8">
                  Контакты
                </Button>
              </div>
            }
          />
        </div>
      </div>
    </main>
  );
}

