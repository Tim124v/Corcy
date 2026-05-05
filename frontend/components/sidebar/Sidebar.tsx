'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  User,
  Users,
  Home,
  Send,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Shield,
} from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { DarkModeToggle } from './DarkModeToggle';
import { useAuthStore } from '../../store/auth';
import { useLanguage } from '../language-provider';
import { useNotificationsStore } from '../../store/notifications';
import { useChatActivityStore } from '../../store/chat-activity';
import { api } from '../../lib/api';

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const isFree = !user?.plan || user.plan === 'FREE';
  const accessToken = useAuthStore((s) => s.accessToken);
  const { language } = useLanguage();
  const unreadNotifications = useNotificationsStore((s) => s.items.filter((item) => !item.read).length);
  const unreadDirectCount = useChatActivityStore((s) => s.unreadDirectCount);
  const unreadRoomCount = useChatActivityStore((s) => s.unreadRoomCount);
  const unreadChatsCount =
    Object.values(unreadDirectCount).reduce((a, b) => a + b, 0) +
    Object.values(unreadRoomCount).reduce((a, b) => a + b, 0);
  const unreadRoomsTotal = Object.values(unreadRoomCount).reduce((a, b) => a + b, 0);

  const [pendingContacts, setPendingContacts] = useState(0);

  useEffect(() => {
    if (!accessToken) {
      setPendingContacts(0);
      return;
    }
    let cancelled = false;
    void api<{ id: string }[]>('/connections/requests', { method: 'GET' })
      .then((list) => {
        if (!cancelled) setPendingContacts(Array.isArray(list) ? list.length : 0);
      })
      .catch(() => {
        if (!cancelled) setPendingContacts(0);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const menu = [
    { icon: MessageCircle, label: language === 'en' ? 'Chats' : 'Чаты', path: '/dashboard', badge: unreadChatsCount, highlight: unreadChatsCount > 0 },
    { icon: Users, label: language === 'en' ? 'Contacts' : 'Контакты', path: '/contacts', badge: pendingContacts, highlight: pendingContacts > 0 },
    { icon: User, label: language === 'en' ? 'Profile' : 'Профиль', path: '/profile' },
    { icon: Home, label: language === 'en' ? 'Rooms' : 'Комнаты', path: '/rooms', badge: unreadRoomsTotal, highlight: unreadRoomsTotal > 0 },
    { icon: Send, label: language === 'en' ? 'Invites' : 'Приглашения', path: '/invites' },
    { icon: Bell, label: language === 'en' ? 'Notifications' : 'Уведомления', path: '/notifications', badge: unreadNotifications, highlight: unreadNotifications > 0 },
    { icon: Settings, label: language === 'en' ? 'Settings' : 'Настройки', path: '/settings' },
    ...(user?.isAdmin
      ? [
          {
            icon: Shield,
            label: language === 'en' ? 'Waitlist' : 'Waitlist',
            path: '/admin/waitlist',
            badge: 0,
            highlight: false,
          },
        ]
      : []),
  ];

  const handleLogout = () => {
    logout();
    router.replace('/');
    onClose?.();
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-full w-[280px] flex-col
          border-r border-slate-200 bg-gradient-to-b from-white to-slate-50
          shadow-[4px_0_24px_-4px_rgba(148,163,184,0.22)]
          transition-transform duration-300 ease-in-out
          dark:border-slate-700/50 dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 dark:shadow-[4px_0_24px_-4px_rgba(0,0,0,0.3)]
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col p-4">
          {/* Logo */}
          <Link
            href="/"
            className="mb-6 flex items-center gap-2 rounded-xl px-3 py-2.5 transition hover:bg-slate-900/5 dark:hover:bg-white/5"
          >
            <div className="flex items-center gap-3 px-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/connexy_icon.svg"
                alt="Connexy"
                width={38}
                height={38}
                className="shrink-0 drop-shadow-[0_0_10px_rgba(99,102,241,0.7)]"
              />
              <div className="flex min-h-[38px] flex-col justify-center gap-1">
                <span
                  className="text-[22px] font-bold leading-none tracking-[-0.03em]"
                  style={{
                    background: 'linear-gradient(180deg, #ffffff 0%, #eef2ff 38%, #a5b4fc 72%, #7c83ff 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Corsy
                </span>
                <span className="text-[9px] font-medium uppercase leading-none tracking-[0.08em] text-slate-500 dark:text-white/45">
                  Private · Secure
                </span>
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {menu.map((item) => (
              <SidebarItem
                key={item.path + item.label}
                icon={item.icon}
                label={item.label}
                path={item.path}
                badge={item.badge}
                highlight={item.highlight}
              />
            ))}
          </nav>

          {/* Dark Mode */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-600/50 dark:bg-slate-800/30">
            <DarkModeToggle />
          </div>

          {/* Help */}
          <Link
            href="/help"
            className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
          >
            <HelpCircle className="h-5 w-5 shrink-0" />
            {language === 'en' ? 'Help & Support' : 'Помощь'}
          </Link>

          {isFree && (
            <Link
              href="/upgrade"
              className="mx-3 mb-3 mt-3 flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/8 px-3 py-2.5 transition-all hover:bg-indigo-500/14"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-indigo-300">{language === 'en' ? 'Upgrade to Pro' : 'Перейти на Pro'}</p>
                <p className="truncate text-[10px] text-indigo-400/60">
                  {language === 'en' ? 'Unlimited invites and rooms' : 'Безлимит инвайтов и комнат'}
                </p>
              </div>
            </Link>
          )}

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {language === 'en' ? 'Log out' : 'Выйти'}
          </button>
        </div>
      </aside>
    </>
  );
}
