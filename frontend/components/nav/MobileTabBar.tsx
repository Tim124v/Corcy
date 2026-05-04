'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useChatActivityStore } from '../../store/chat-activity';
import { useAuthStore } from '../../store/auth';

type Tab = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  isActive: (pathname: string) => boolean;
};

function IconWrapper({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-6 w-6 items-center justify-center">{children}</span>;
}

function ContactsIcon(active: boolean) {
  return (
    <IconWrapper>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22 21v-2a4 4 0 0 0-3-3.87"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={active ? 1 : 0.55}
        />
        <path
          d="M16 3.13a4 4 0 0 1 0 7.75"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={active ? 1 : 0.55}
        />
      </svg>
    </IconWrapper>
  );
}

function CallsIcon() {
  return (
    <IconWrapper>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3 5.18 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.5a2 2 0 0 1-.45 2.11L9 10.09a16 16 0 0 0 5 5l.76-1.09a2 2 0 0 1 2.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0 1 22 16.92Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </IconWrapper>
  );
}

function ChatsIcon() {
  return (
    <IconWrapper>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </IconWrapper>
  );
}

function ProfileIcon() {
  return (
    <IconWrapper>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M20 21a8 8 0 0 0-16 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </IconWrapper>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isPro = user?.plan === 'PRO' || user?.plan === 'TEAM';
  const unreadTotal = useChatActivityStore((s) => {
    const direct = Object.values(s.unreadDirectCount).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
    const rooms = Object.values(s.unreadRoomCount).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
    return direct + rooms;
  });

  const tabs: Tab[] = useMemo(
    () => [
      {
        href: '/contacts',
        label: 'Контакты',
        icon: (active) => ContactsIcon(active),
        isActive: (p) => p === '/contacts',
      },
      {
        href: '/calls',
        label: 'Звонки',
        icon: () => CallsIcon(),
        isActive: (p) => p === '/calls',
      },
      {
        href: '/dashboard',
        label: 'Чаты',
        icon: () => ChatsIcon(),
        isActive: (p) => p === '/dashboard',
      },
      {
        href: '/profile',
        label: 'Профиль',
        icon: () => ProfileIcon(),
        isActive: (p) => p === '/profile' || p.startsWith('/settings'),
      },
    ],
    [],
  );

  return (
    <nav
      className="mobile-tabbar fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-950/92 text-slate-200 backdrop-blur-xl lg:hidden"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.25rem)',
      }}
      aria-label="Основная навигация"
    >
      <div className="mx-auto flex max-w-[720px] items-center justify-around px-3 py-2">
        {tabs.map((t) => {
          const active = t.isActive(pathname);
          const isChats = t.href === '/dashboard';
          const isProfile = t.href === '/profile';
          const badgeText = unreadTotal > 99 ? '99+' : unreadTotal > 0 ? String(unreadTotal) : null;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex min-w-[74px] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] transition ${
                active
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={`inline-flex items-center justify-center rounded-full px-3 py-1 transition ${
                  active ? 'bg-white/10' : 'bg-transparent'
                }`}
              >
                <span className="relative">
                  {t.icon(active)}
                  {isChats && badgeText && (
                    <span
                      className="absolute -right-2 -top-1.5 min-w-[18px] rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_8px_18px_-10px_rgba(244,63,94,0.9)]"
                      aria-label={`Непрочитанных: ${badgeText}`}
                    >
                      {badgeText}
                    </span>
                  )}
                  {isProfile && isPro && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-indigo-500 ring-1 ring-slate-950" />
                  )}
                </span>
              </span>
              <span className={`leading-none ${active ? 'font-semibold' : 'font-medium'}`}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

