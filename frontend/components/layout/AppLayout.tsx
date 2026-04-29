'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '../sidebar/Sidebar';
import { useAuthStore } from '../../store/auth';
import { MobileTabBar } from '../nav/MobileTabBar';

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

      {/* Desktop sidebar toggle (only if needed later) */}

      <main className={`min-h-screen transition-all duration-300 ${shouldShowSidebar ? 'lg:ml-[280px]' : ''}`}>
        <div
          className={`min-h-screen px-4 ${
            shouldShowSidebar ? 'pt-4 pb-28 lg:px-8 lg:pt-8 lg:pb-8' : 'pt-0 pb-8 lg:px-0 lg:pt-0'
          }`}
        >
          {children}
        </div>
      </main>

      {shouldShowSidebar && <MobileTabBar />}
    </div>
  );
}
