'use client';

import Link from 'next/link';

export default function NoInvitePage() {
  return (
    <main className="min-h-screen bg-[#070d1a] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[#070d1a]">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px]
          bg-violet-600/8 rounded-full blur-[120px] pointer-events-none"
        />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        <p className="text-white/30 text-xs font-medium tracking-[0.3em] uppercase mb-10">C O N N E X Y</p>

        <div
          className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10
          flex items-center justify-center text-4xl mx-auto mb-6"
        >
          🔐
        </div>

        <h1 className="text-white text-2xl font-semibold mb-3">Только по приглашению</h1>
        <p className="text-white/50 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
          Connexy — закрытая сеть. Чтобы создать аккаунт, тебе нужна ссылка-приглашение от кого-то кто уже в системе.
        </p>

        <div className="bg-white/5 border border-white/8 rounded-2xl p-5 mb-8 text-left space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-lg">👥</span>
            <div>
              <p className="text-white text-sm font-medium">Попроси кого-то пригласить тебя</p>
              <p className="text-white/40 text-xs mt-0.5">Пусть отправят ссылку из раздела &quot;Приглашения&quot;</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg">🔗</span>
            <div>
              <p className="text-white text-sm font-medium">Перейди по ссылке</p>
              <p className="text-white/40 text-xs mt-0.5">Ссылка выглядит как connexy.app/invite/...</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg">✅</span>
            <div>
              <p className="text-white text-sm font-medium">Создай аккаунт</p>
              <p className="text-white/40 text-xs mt-0.5">Кнопка регистрации появится автоматически</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/auth/login"
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500
              text-white text-sm font-medium transition-colors text-center"
          >
            Уже есть аккаунт? Войти
          </Link>
          <Link
            href="/waitlist"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600
              hover:from-blue-500 hover:to-violet-500
              text-white text-sm font-medium transition-colors text-center"
          >
            Join the Waitlist →
          </Link>
          <Link
            href="/"
            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10
              border border-white/8 text-white/60 text-sm transition-colors text-center"
          >
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}

