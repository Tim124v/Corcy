'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { usePushNotifications } from '../../hooks/use-push-notifications';

type UserProfile = {
  name: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  isVerified: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, accessToken } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { language } = useLanguage();
  const addNotification = useNotificationsStore((s) => s.addNotification);
  const notificationsEnabled = useNotificationsStore((s) => s.enabled);
  const setNotificationsEnabled = useNotificationsStore((s) => s.setEnabled);
  const notificationCategoryEnabled = useNotificationsStore((s) => s.categoryEnabled);
  const setNotificationCategoryEnabled = useNotificationsStore((s) => s.setCategoryEnabled);
  const { permission: pushPermission, subscribed: pushSubscribed, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } =
    usePushNotifications();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState<'idle' | 'setup' | 'backup' | 'disable'>('idle');
  const [twoFaQr, setTwoFaQr] = useState('');
  const [twoFaSecret, setTwoFaSecret] = useState('');
  const [twoFaBackupCodes, setTwoFaBackupCodes] = useState<string[]>([]);
  const [twoFaToken, setTwoFaToken] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaError, setTwoFaError] = useState('');
  const [planInfo, setPlanInfo] = useState<{
    plan: string;
    planExpiresAt: string | null;
    limits: {
      maxInvitesPerMonth: number;
      maxRooms: number;
      maxRoomMembers: number;
      maxContacts: number;
      unlimitedHistory: boolean;
      e2eRooms: boolean;
    };
    usage: {
      invitesThisMonth: number;
      rooms: number;
      contacts: number;
    };
  } | null>(null);

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

  useEffect(() => {
    if (!accessToken) return;
    void api<typeof planInfo>('/users/me/plan')
      .then((data) => setPlanInfo(data as typeof planInfo))
      .catch(() => {});
  }, [accessToken]);

  const handleManageBilling = useCallback(async () => {
    try {
      const res = await api<{ url: string }>('/payments/billing-portal', {
        method: 'POST',
      });
      window.location.href = res.url;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Billing portal error:', err);
    }
  }, []);

  const handleToggleTwoFactor = async () => {
    if (!user) return;

    if (twoFactorEnabled) {
      setTwoFaStep('disable');
      setTwoFaToken('');
      setTwoFaError('');
      return;
    }

    setTwoFaLoading(true);
    setTwoFaError('');
    try {
      const res = await api<{ ok: boolean; qrCode?: string; secret?: string; backupCodes?: string[]; error?: string }>(
        '/auth/2fa/setup',
        { method: 'POST' },
      );
      if (!res.ok) {
        setTwoFaError(res.error || 'Ошибка');
        return;
      }
      setTwoFaQr(res.qrCode || '');
      setTwoFaSecret(res.secret || '');
      setTwoFaBackupCodes(res.backupCodes || []);
      setTwoFaStep('setup');
      setTwoFaToken('');
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleActivate2FA = async () => {
    if (!user) return;
    setTwoFaLoading(true);
    setTwoFaError('');
    try {
      const res = await api<{ ok: boolean; error?: string }>('/auth/2fa/activate', {
        method: 'POST',
        body: JSON.stringify({ token: twoFaToken }),
      });
      if (!res.ok) {
        setTwoFaError(res.error || 'Неверный код');
        return;
      }
      setTwoFaStep('backup');
      setTwoFactorEnabled(true);
      localStorage.setItem(`connexy-2fa:${user.id}`, 'true');
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!user) return;
    setTwoFaLoading(true);
    setTwoFaError('');
    try {
      const res = await api<{ ok: boolean; error?: string }>('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ token: twoFaToken }),
      });
      if (!res.ok) {
        setTwoFaError(res.error || 'Неверный код');
        return;
      }
      setTwoFaStep('idle');
      setTwoFactorEnabled(false);
      localStorage.removeItem(`connexy-2fa:${user.id}`);
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setTwoFaLoading(false);
    }
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
              onToggleTwoFactor={() => void handleToggleTwoFactor()}
              onPasswordClick={() => {
                setPasswordMessage('');
                setIsPasswordModalOpen(true);
              }}
              onSessionsClick={() => setIsSessionsModalOpen(true)}
            />

            {/* 2FA Модал — Setup */}
            {twoFaStep === 'setup' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
                  <h3 className="mb-1 text-lg font-semibold text-white">
                    {language === 'en' ? 'Enable 2FA' : 'Включить 2FA'}
                  </h3>
                  <p className="mb-4 text-xs text-slate-400">
                    {language === 'en'
                      ? 'Scan the QR code in Google Authenticator, Authy, or any TOTP app.'
                      : 'Отсканируйте QR-код в Google Authenticator, Authy или любом TOTP-приложении.'}
                  </p>

                  {twoFaQr && (
                    <div className="mb-4 flex justify-center">
                      <img src={twoFaQr} alt="2FA QR Code" className="h-44 w-44 rounded-xl bg-white p-2" />
                    </div>
                  )}

                  <div className="mb-4 rounded-xl bg-white/5 px-3 py-2 text-center">
                    <p className="mb-1 text-[10px] text-slate-500">
                      {language === 'en' ? 'Or enter manually:' : 'Или введите вручную:'}
                    </p>
                    <p className="break-all font-mono text-xs text-indigo-300">{twoFaSecret}</p>
                  </div>

                  <p className="mb-2 text-xs text-slate-400">
                    {language === 'en'
                      ? 'Enter the 6-digit code from the app to confirm:'
                      : 'Введите 6-значный код из приложения для подтверждения:'}
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={twoFaToken}
                    onChange={(e) => setTwoFaToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="mb-3 w-full rounded-xl bg-slate-950/40 px-4 py-3 text-center font-mono text-2xl tracking-widest text-white caret-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-indigo-500"
                    style={{ fontSize: '24px' }}
                    autoFocus
                  />

                  {twoFaError && <p className="mb-3 text-center text-xs text-red-400">{twoFaError}</p>}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFaStep('idle');
                        setTwoFaToken('');
                        setTwoFaError('');
                      }}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-400 hover:bg-white/10"
                    >
                      {language === 'en' ? 'Cancel' : 'Отмена'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleActivate2FA()}
                      disabled={twoFaToken.length !== 6 || twoFaLoading}
                      className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {twoFaLoading ? '...' : language === 'en' ? 'Confirm' : 'Подтвердить'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2FA Модал — Backup codes */}
            {twoFaStep === 'backup' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    <h3 className="text-lg font-semibold text-white">{language === 'en' ? '2FA enabled!' : '2FA включена!'}</h3>
                  </div>
                  <p className="mb-4 text-xs text-slate-400">
                    {language === 'en'
                      ? 'Save these backup codes. You will need them if you lose access to your authenticator app.'
                      : 'Сохраните резервные коды. Они понадобятся если потеряете доступ к приложению.'}
                    <span className="mt-1 block text-amber-400">
                      {language === 'en' ? 'Shown only once!' : 'Показываются только один раз!'}
                    </span>
                  </p>

                  <div className="mb-4 grid grid-cols-2 gap-2">
                    {twoFaBackupCodes.map((code) => (
                      <div key={code} className="rounded-lg bg-white/5 px-3 py-2 text-center font-mono text-sm text-slate-200">
                        {code}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(twoFaBackupCodes.join('\n')).catch(() => {});
                    }}
                    className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-slate-400 hover:bg-white/10"
                  >
                    {language === 'en' ? 'Copy all codes' : 'Скопировать все коды'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTwoFaStep('idle')}
                    className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    {language === 'en' ? 'Done' : 'Готово'}
                  </button>
                </div>
              </div>
            )}

            {/* 2FA Модал — Disable */}
            {twoFaStep === 'disable' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
                  <h3 className="mb-1 text-lg font-semibold text-white">
                    {language === 'en' ? 'Disable 2FA' : 'Отключить 2FA'}
                  </h3>
                  <p className="mb-4 text-xs text-slate-400">
                    {language === 'en'
                      ? 'Enter the current code from your authenticator app to confirm.'
                      : 'Введите текущий код из приложения для подтверждения отключения.'}
                  </p>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={twoFaToken}
                    onChange={(e) => setTwoFaToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="mb-3 w-full rounded-xl bg-slate-950/40 px-4 py-3 text-center font-mono text-2xl tracking-widest text-white caret-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-red-500"
                    style={{ fontSize: '24px' }}
                    autoFocus
                  />

                  {twoFaError && <p className="mb-3 text-center text-xs text-red-400">{twoFaError}</p>}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFaStep('idle');
                        setTwoFaToken('');
                        setTwoFaError('');
                      }}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-400 hover:bg-white/10"
                    >
                      {language === 'en' ? 'Cancel' : 'Отмена'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDisable2FA()}
                      disabled={twoFaToken.length !== 6 || twoFaLoading}
                      className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {twoFaLoading ? '...' : language === 'en' ? 'Disable' : 'Отключить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
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

          {planInfo && (
            <section className="app-shell-card rounded-[24px] p-6 dark:border-slate-700/60">
              <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {language === 'en' ? 'Current plan' : 'Текущий план'}
              </h3>

              {searchParams.get('payment') === 'success' && (
                <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300">
                  ✓ {language === 'en' ? 'Payment successful! Your plan will update shortly.' : 'Оплата прошла успешно! План обновится в ближайшее время.'}
                </div>
              )}
              {searchParams.get('payment') === 'canceled' && (
                <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                  {language === 'en' ? 'Payment canceled.' : 'Оплата отменена.'}
                </div>
              )}

              <div className="mb-5 flex items-center gap-3">
                <span
                  className={`rounded-xl px-4 py-1.5 text-sm font-semibold ${
                    planInfo.plan === 'FREE'
                      ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      : planInfo.plan === 'PRO'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-violet-600 text-white'
                  }`}
                >
                  {planInfo.plan}
                </span>
                {planInfo.planExpiresAt && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'en'
                      ? `until ${new Date(planInfo.planExpiresAt).toLocaleDateString('en-US')}`
                      : `до ${new Date(planInfo.planExpiresAt).toLocaleDateString('ru-RU')}`}
                  </span>
                )}
              </div>

              <div className="mb-5 flex flex-col gap-4">
                {[
                  {
                    label: language === 'en' ? 'Invites this month' : 'Инвайты этого месяца',
                    used: planInfo.usage.invitesThisMonth,
                    max: planInfo.limits.maxInvitesPerMonth,
                  },
                  {
                    label: language === 'en' ? 'Rooms' : 'Комнаты',
                    used: planInfo.usage.rooms,
                    max: planInfo.limits.maxRooms,
                  },
                  {
                    label: language === 'en' ? 'Contacts' : 'Контакты',
                    used: planInfo.usage.contacts,
                    max: planInfo.limits.maxContacts,
                  },
                ].map((item) => {
                  const unlimited = item.max === -1;
                  const pct = unlimited ? 0 : Math.min((item.used / item.max) * 100, 100);
                  const near = !unlimited && pct >= 80;
                  const atLimit = !unlimited && item.used >= item.max;

                  return (
                    <div key={item.label}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{item.label}</span>
                        <span
                          className={`text-xs font-medium ${
                            atLimit ? 'text-red-500' : near ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {unlimited ? `${item.used} / ∞` : `${item.used} / ${item.max}`}
                        </span>
                      </div>
                      {!unlimited && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all ${
                              atLimit ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: language === 'en' ? 'Room members' : 'Участников в комнате',
                      value: planInfo.limits.maxRoomMembers,
                    },
                    {
                      label: language === 'en' ? 'Message history' : 'История сообщений',
                      value: planInfo.limits.unlimitedHistory ? '∞' : (language === 'en' ? '30 days' : '30 дней'),
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-slate-900/5 px-4 py-3 dark:bg-white/5">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">{item.value}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {planInfo.plan !== 'TEAM' && (
                <button
                  type="button"
                  onClick={() => router.push('/upgrade')}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white transition-all hover:from-indigo-500 hover:to-violet-500"
                >
                  {language === 'en' ? 'Upgrade plan →' : 'Улучшить план →'}
                </button>
              )}

              {planInfo.plan !== 'FREE' && (
                <button
                  type="button"
                  onClick={() => void handleManageBilling()}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs text-slate-600 transition-all hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
                >
                  {language === 'en' ? 'Manage subscription' : 'Управление подпиской'}
                </button>
              )}
            </section>
          )}

          <section className="app-shell-card rounded-[24px] p-6 dark:border-slate-700/60">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  {language === 'en' ? 'Push notifications' : 'Push-уведомления'}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-500">
                  {pushPermission === 'denied'
                    ? language === 'en'
                      ? 'Blocked in browser settings'
                      : 'Заблокированы в настройках браузера'
                    : pushSubscribed
                      ? language === 'en'
                        ? 'You get alerts for new messages when the tab is closed'
                        : 'Уведомления о новых сообщениях, даже когда вкладка закрыта'
                      : language === 'en'
                        ? 'Get notified about new messages when the tab is closed (requires production / HTTPS)'
                        : 'Получать уведомления о новых сообщениях, когда вкладка закрыта (нужны HTTPS / production)'}
                </p>
              </div>
              {pushPermission !== 'denied' && (
                <button
                  type="button"
                  onClick={() => void (pushSubscribed ? pushUnsubscribe() : pushSubscribe())}
                  className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                    pushSubscribed
                      ? 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500'
                  }`}
                >
                  {pushSubscribed
                    ? language === 'en'
                      ? 'Turn off'
                      : 'Отключить'
                    : language === 'en'
                      ? 'Turn on'
                      : 'Включить'}
                </button>
              )}
            </div>
          </section>
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
