'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '../sidebar/Sidebar';
import { useAuthStore } from '../../store/auth';

type AppLayoutProps = {
  children: React.ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { accessToken, hydrated } = useAuthStore();
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/invite/');
  const shouldShowSidebar = hydrated && !!accessToken && !isPublicRoute;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {shouldShowSidebar && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile menu button */}
      {shouldShowSidebar && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white shadow-lg lg:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <main className={`min-h-screen transition-all duration-300 ${shouldShowSidebar ? 'lg:ml-[280px]' : ''}`}>
        <div className={`min-h-screen px-4 pb-8 ${shouldShowSidebar ? 'pt-16 lg:px-8 lg:pt-8' : 'pt-0 lg:px-0 lg:pt-0'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
