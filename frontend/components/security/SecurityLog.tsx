'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguage } from '../language-provider';

type AuditEntry = {
  id: string;
  action: string;
  ipAddress?: string | null;
  createdAt: string;
  severity: string;
};

const ACTION_LABELS_RU: Record<string, string> = {
  USER_LOGIN: 'Вход в аккаунт',
  USER_LOGOUT: 'Выход из аккаунта',
  EMAIL_VERIFIED: 'Email подтверждён',
  '2FA_ENABLED': 'Включена двухфакторная защита',
  '2FA_DISABLED': 'Отключена двухфакторная защита',
  '2FA_SETUP_INITIATED': 'Начата настройка 2FA',
  SESSION_REVOKED: 'Завершена сессия',
  REFRESH_TOKEN_REUSE_OR_INVALID: 'Подозрительная активность по сессии',
  PASSWORD_CHANGED: 'Изменён пароль',
  INVITE_CREATED: 'Создано приглашение',
  INVITE_USED: 'Использовано приглашение',
};

const ACTION_LABELS_EN: Record<string, string> = {
  USER_LOGIN: 'Signed in',
  USER_LOGOUT: 'Signed out',
  EMAIL_VERIFIED: 'Email verified',
  '2FA_ENABLED': 'Two-factor enabled',
  '2FA_DISABLED': 'Two-factor disabled',
  '2FA_SETUP_INITIATED': '2FA setup started',
  SESSION_REVOKED: 'Session revoked',
  REFRESH_TOKEN_REUSE_OR_INVALID: 'Suspicious session activity',
  PASSWORD_CHANGED: 'Password changed',
  INVITE_CREATED: 'Invite created',
  INVITE_USED: 'Invite used',
};

export function SecurityLog() {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const labels = language === 'en' ? ACTION_LABELS_EN : ACTION_LABELS_RU;

  useEffect(() => {
    api<{ logs: AuditEntry[] }>('/users/me/security-log')
      .then((data) => setLogs(data.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400 text-sm">{language === 'en' ? 'Loading…' : 'Загрузка…'}</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="text-gray-400 text-sm text-center py-4">
        {language === 'en' ? 'No activity yet' : 'История активности пуста'}
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {logs.map((entry) => (
        <div
          key={entry.id}
          className={`flex justify-between items-start p-3 rounded-lg text-sm ${
            entry.severity === 'CRITICAL' || entry.severity === 'HIGH'
              ? 'bg-red-900/20 border border-red-800/30'
              : 'bg-white/5'
          }`}
        >
          <span className="text-gray-200">
            {labels[entry.action] || entry.action}
            {entry.ipAddress && (
              <span className="text-gray-500 text-xs ml-2">· {entry.ipAddress}</span>
            )}
          </span>
          <span className="text-gray-500 text-xs whitespace-nowrap ml-3">
            {new Date(entry.createdAt).toLocaleString(language === 'en' ? 'en-US' : 'ru-RU', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
