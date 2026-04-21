'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { useTheme } from '../../components/theme-provider';
import { useLanguage } from '../../components/language-provider';
import { SecurityPanel } from '../../components/profile/SecurityPanel';
import { SecurityLog } from '../../components/security/SecurityLog';
import { AppearancePanel } from '../../components/profile/AppearancePanel';
import { useNotificationsStore, type NotificationType } from '../../store/notifications';
import { SecureInput } from '../../components/ui/SecureInput';
import { Button } from '../../components/ui/Button';

type UserProfile = {
  name: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  isVerified: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { language } = useLanguage();
  const addNotification = useNotificationsStore((s) => s.addNotification);
  const notificationsEnabled = useNotificationsStore((s) => s.enabled);
  const setNotificationsEnabled = useNotificationsStore((s) => s.setEnabled);
  const notificationCategoryEnabled = useNotificationsStore((s) => s.categoryEnabled);
  const setNotificationCategoryEnabled = useNotificationsStore((s) => s.setCategoryEnabled);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);

  const passwordSubtitle = useMemo(() => {
    if (typeof window === 'undefined' || !user) {
      return language === 'en' ? 'Not changed yet' : 'Не изменён';
    }
    const stored = localStorage.getItem(`connexy-password-changed-at:${user.id}`);
    if (!stored) return language === 'en' ? 'Not changed yet' : 'Не изменён';
    return language === 'en'
      ? `Last changed ${new Date(stored).toLocaleDateString('en-US')}`
      : `Изменён ${new Date(stored).toLocaleDateString('ru-RU')}`;
  }, [user, passwordSaving, language]);

  const loadSettingsData = async () => {
    if (!accessToken) return;
    try {
      const me = await api<UserProfile>('/users/me');
      setUserProfile(me);
    } catch {
      router.replace('/');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !accessToken) {
      if (!accessToken) router.replace('/');
      return;
    }
    if (user) {
      const storedTwoFactor = localStorage.getItem(`connexy-2fa:${user.id}`);
      setTwoFactorEnabled(storedTwoFactor === 'true');
    }
    void loadSettingsData();
  }, [accessToken, router, user]);

  const toggleTwoFactor = () => {
    if (!user) return;
    setTwoFactorEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(`connexy-2fa:${user.id}`, String(next));
      return next;
    });
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !user) return;
    setPasswordSaving(true);
    setPasswordMessage('');
    try {
      await api('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const changedAt = new Date().toISOString();
      localStorage.setItem(`connexy-password-changed-at:${user.id}`, changedAt);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(language === 'en' ? 'Password updated successfully.' : 'Пароль успешно обновлён.');
      addNotification({
        type: 'security',
        title: language === 'en' ? 'Password changed' : 'Пароль изменён',
        message: language === 'en' ? 'Your account password was updated successfully.' : 'Пароль вашего аккаунта был успешно обновлён.',
      });
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : language === 'en' ? 'Failed to update password' : 'Не удалось обновить пароль');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleNotificationCategoryToggle = (type: NotificationType, enabled: boolean) => {
    setNotificationCategoryEnabled(type, enabled);
  };

  if (!user) return null;

  return (
    <main className="app-page-bg min-h-screen text-slate-900 dark:text-slate-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-8 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute right-8 top-10 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute inset-0 opacity-20 mix-blend-soft-light" style={{ backgroundImage: 'radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.08), transparent 50%), radial-gradient(1px 1px at 80% 0%, rgba(255,255,255,0.05), transparent 50%)' }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <header className="mb-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="transition hover:text-blue-600 dark:hover:text-blue-300">← {language === 'en' ? 'Chats' : 'Чаты'}</Link>
          <span>/</span>
          <span>{language === 'en' ? 'Settings' : 'Настройки'}</span>
        </header>

        <div className="space-y-6">
          <div>
            <SecurityPanel
              onViewAll={() => setIsPasswordModalOpen(true)}
              isVerified={userProfile?.isVerified ?? false}
              twoFaEnabled={twoFactorEnabled}
              passwordSubtitle={passwordSubtitle}
              sessionsCount={1}
              onToggleTwoFactor={toggleTwoFactor}
              onPasswordClick={() => {
                setPasswordMessage('');
                setIsPasswordModalOpen(true);
              }}
              onSessionsClick={() => setIsSessionsModalOpen(true)}
            />
          </div>

          <section className="app-shell-card rounded-[24px] p-6 dark:border-slate-700/60">
            <h2 className="mb-3 text-lg font-semibold text-slate-950 dark:text-white">
              {language === 'en' ? 'Activity history' : 'История активности'}
            </h2>
            <SecurityLog />
          </section>

          <div id="appearance-card">
            <AppearancePanel
              theme={theme}
              onThemeChange={setTheme}
              notificationsEnabled={notificationsEnabled}
              onNotificationsToggle={setNotificationsEnabled}
              notificationCategoryEnabled={notificationCategoryEnabled}
              onNotificationCategoryToggle={handleNotificationCategoryToggle}
            />
          </div>
        </div>
      </div>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm dark:bg-slate-950/70"
            aria-label={language === 'en' ? 'Close password modal' : 'Закрыть окно смены пароля'}
            onClick={() => setIsPasswordModalOpen(false)}
          />
          <section className="app-shell-card relative z-10 w-full max-w-2xl rounded-[28px] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{language === 'en' ? 'Change password' : 'Сменить пароль'}</h2>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="rounded-full bg-slate-900/5 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-900/10 hover:text-slate-900 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1] dark:hover:text-white"
              >
                {language === 'en' ? 'Close' : 'Закрыть'}
              </button>
            </div>
            <form onSubmit={changePassword} className="space-y-4">
              <SecureInput
                autoComplete="current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder={language === 'en' ? 'Current password' : 'Текущий пароль'}
                className="w-full rounded-xl border border-slate-200 bg-white/80 pr-[4.5rem] px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <SecureInput
                autoComplete="new-password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder={language === 'en' ? 'New password' : 'Новый пароль'}
                className="w-full rounded-xl border border-slate-200 bg-white/80 pr-[4.5rem] px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <SecureInput
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder={language === 'en' ? 'Repeat new password' : 'Повторите новый пароль'}
                className="w-full rounded-xl border border-slate-200 bg-white/80 pr-[4.5rem] px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {passwordMessage && <p className="text-sm text-slate-600 dark:text-slate-300">{passwordMessage}</p>}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={passwordSaving} loading={passwordSaving}>
                  {passwordSaving ? (language === 'en' ? 'Saving...' : 'Сохраняем...') : (language === 'en' ? 'Update password' : 'Обновить пароль')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setIsPasswordModalOpen(false)}>
                  {language === 'en' ? 'Cancel' : 'Отмена'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isSessionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm dark:bg-slate-950/70"
            aria-label={language === 'en' ? 'Close sessions modal' : 'Закрыть окно активных сессий'}
            onClick={() => setIsSessionsModalOpen(false)}
          />
          <section className="app-shell-card relative z-10 w-full max-w-2xl rounded-[28px] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{language === 'en' ? 'Active Sessions' : 'Активные сессии'}</h2>
              <button
                type="button"
                onClick={() => setIsSessionsModalOpen(false)}
                className="rounded-full bg-slate-900/5 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-900/10 hover:text-slate-900 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1] dark:hover:text-white"
              >
                {language === 'en' ? 'Close' : 'Закрыть'}
              </button>
            </div>
            <div className="app-shell-muted rounded-xl px-4 py-4">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{language === 'en' ? 'Current browser session' : 'Текущая сессия браузера'}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {language === 'en'
                  ? '1 active device is connected with your current account token.'
                  : '1 активное устройство подключено с текущим токеном аккаунта.'}
              </div>
            </div>
            <div className="app-shell-muted mt-4 flex items-center justify-between rounded-xl px-4 py-3">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-200">{language === 'en' ? 'Connected devices' : 'Подключённые устройства'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{language === 'en' ? '1 device connected' : '1 устройство подключено'}</div>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                {language === 'en' ? 'Active' : 'Активно'}
              </span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
