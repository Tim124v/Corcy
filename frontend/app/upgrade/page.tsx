'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';

type PlanInfo = {
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
};

const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: '$0',
    period: 'навсегда',
    description: 'Для личного использования',
    color: 'border-white/10',
    badge: null as string | null,
    features: [
      { text: '3 приглашения в месяц', included: true },
      { text: '2 комнаты', included: true },
      { text: '10 контактов', included: true },
      { text: 'До 10 участников в комнате', included: true },
      { text: 'История 30 дней', included: true },
      { text: 'Безлимитные приглашения', included: false },
      { text: 'E2E шифрование комнат', included: false },
      { text: 'Приоритетная поддержка', included: false },
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '$4.99',
    period: 'в месяц',
    description: 'Для активных пользователей',
    color: 'border-indigo-500/60',
    badge: 'Популярный',
    features: [
      { text: 'Безлимитные приглашения', included: true },
      { text: '10 комнат', included: true },
      { text: 'Безлимитные контакты', included: true },
      { text: 'До 50 участников в комнате', included: true },
      { text: 'Безлимитная история', included: true },
      { text: 'E2E шифрование комнат', included: true },
      { text: 'Приоритетная поддержка', included: false },
      { text: 'Корпоративные функции', included: false },
    ],
  },
  {
    id: 'TEAM',
    name: 'Team',
    price: '$12',
    period: 'в месяц',
    description: 'Для команд и бизнеса',
    color: 'border-violet-500/60',
    badge: 'Максимум',
    features: [
      { text: 'Безлимитные приглашения', included: true },
      { text: 'Безлимитные комнаты', included: true },
      { text: 'Безлимитные контакты', included: true },
      { text: 'До 200 участников в комнате', included: true },
      { text: 'Безлимитная история', included: true },
      { text: 'E2E шифрование комнат', included: true },
      { text: 'Приоритетная поддержка', included: true },
      { text: 'Корпоративные функции', included: true },
    ],
  },
] as const;

export default function UpgradePage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!accessToken) {
      router.replace('/');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      const plan = params.get('plan') ?? '';
      setSuccessMessage(`Поздравляем! Ваш план обновлён до ${plan}.`);
      window.history.replaceState({}, '', '/upgrade');
    }

    void api<PlanInfo>('/users/me/plan').then(setPlanInfo).catch(() => {});
  }, [accessToken, router]);

  const handleUpgrade = async (plan: 'PRO' | 'TEAM') => {
    setLoadingPlan(plan);
    try {
      const res = await api<{ url: string }>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
      window.location.href = res.url;
    } catch {
      setLoadingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const res = await api<{ url: string }>('/payments/billing-portal', {
        method: 'POST',
      });
      window.location.href = res.url;
    } catch {
      setLoading(false);
    }
  };

  const currentPlan = planInfo?.plan ?? 'FREE';

  return (
    <main className="app-page-bg min-h-screen text-slate-900 dark:text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/settings" className="transition-colors hover:text-slate-300">
            ← Настройки
          </Link>
          <span>/</span>
          <span className="text-slate-300 dark:text-slate-200">Планы</span>
        </div>

        <div className="mb-10 text-center">
          <h1 className="mb-3 text-3xl font-semibold text-slate-950 dark:text-white">Выберите план</h1>
          <p className="mx-auto max-w-md text-slate-500 dark:text-slate-400">
            Connexy растёт вместе с вами. Начните бесплатно и переходите на следующий уровень когда будете готовы.
          </p>
        </div>

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-center text-sm text-emerald-300">
            ✓ {successMessage}
          </div>
        )}

        <div className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isDowngrade =
              (currentPlan === 'PRO' && plan.id === 'FREE') || (currentPlan === 'TEAM' && plan.id !== 'TEAM');
            const isUpgrade =
              (currentPlan === 'FREE' && plan.id !== 'FREE') || (currentPlan === 'PRO' && plan.id === 'TEAM');

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-white/4 p-6 transition-all dark:bg-white/5 ${plan.color} ${
                  isCurrent ? 'ring-1 ring-indigo-500/40' : ''
                } ${plan.id === 'PRO' ? 'md:-mt-2 md:mb-2' : ''}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        plan.id === 'PRO' ? 'bg-indigo-600 text-white' : 'bg-violet-600 text-white'
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Текущий</span>
                  </div>
                )}

                <div className="mb-5">
                  <h2 className="mb-1 text-lg font-semibold text-slate-950 dark:text-white">{plan.name}</h2>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-950 dark:text-white">{plan.price}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{plan.period}</span>
                  </div>
                </div>

                <ul className="mb-6 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className="flex items-center gap-2.5 text-sm">
                      {feature.included ? (
                        <svg className="h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 shrink-0 text-slate-500/60" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      <span className={feature.included ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500/70'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full cursor-default rounded-xl bg-white/8 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400"
                  >
                    Текущий план
                  </button>
                ) : plan.id === 'FREE' ? (
                  <button
                    onClick={() => void handleManageBilling()}
                    disabled={loading || isDowngrade}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-500 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400"
                  >
                    {isDowngrade ? 'Отменить подписку →' : 'Выбрать Free'}
                  </button>
                ) : isUpgrade ? (
                  <button
                    onClick={() => void handleUpgrade(plan.id as 'PRO' | 'TEAM')}
                    disabled={loadingPlan === plan.id}
                    className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                      plan.id === 'PRO'
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500'
                        : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500'
                    }`}
                  >
                    {loadingPlan === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border border-white border-t-transparent" />
                        Переход...
                      </span>
                    ) : (
                      `Перейти на ${plan.name} →`
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => void handleManageBilling()}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-500 transition-all hover:bg-white/10 dark:text-slate-400"
                  >
                    Управление →
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/4 p-6 dark:bg-white/5">
          <h3 className="mb-4 text-base font-medium text-slate-950 dark:text-white">Частые вопросы</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              {
                q: 'Могу ли я отменить подписку?',
                a: 'Да, в любой момент. Доступ к платным функциям сохраняется до конца оплаченного периода.',
              },
              {
                q: 'Как происходит оплата?',
                a: 'Через Stripe — безопасный платёжный сервис. Мы не храним данные карты.',
              },
              {
                q: 'Что будет с данными при переходе на Free?',
                a: 'Все сообщения и контакты сохраняются. Новые комнаты и инвайты будут ограничены лимитом Free.',
              },
              {
                q: 'Есть ли пробный период?',
                a: 'Нет, но план Free работает бесплатно бессрочно. Оплата только за Pro и Team.',
              },
            ].map((item) => (
              <div key={item.q}>
                <p className="mb-1 text-sm font-medium text-slate-900 dark:text-slate-200">{item.q}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-500">
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            Оплата через Stripe
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            SSL шифрование
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Отмена в любой момент
          </span>
        </div>
      </div>
    </main>
  );
}

