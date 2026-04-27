'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth';

// ─── Анимированные частицы (canvas) ───────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener('resize', resize);

    // Создаём частицы
    const COUNT = Math.min(60, Math.floor((W * H) / 18000));
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Линии между близкими частицами
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Точки
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(139,92,246,0.6)';
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}

// ─── Анимация шифрования ──────────────────────────────────────────────────
function EncryptionAnimation() {
  return (
    <div className="relative mx-auto w-full max-w-lg select-none">
      {/* Контейнер */}
      <div className="relative flex items-center justify-between gap-4 rounded-3xl border border-white/8 bg-white/[0.03] px-6 py-8 backdrop-blur-sm">

        {/* Левое устройство — отправитель */}
        <div className="flex flex-col items-center gap-3 min-w-[80px]">
          <div className="flex h-14 w-10 flex-col items-center justify-end gap-1 rounded-xl border border-white/15 bg-slate-800/80 pb-2 shadow-lg">
            <div className="h-1 w-6 rounded-full bg-blue-400/60" />
            <div className="h-1 w-4 rounded-full bg-blue-400/40" />
            <div className="h-1 w-5 rounded-full bg-blue-400/50" />
          </div>
          <span className="text-[10px] text-slate-500 tracking-wider">SENDER</span>
        </div>

        {/* Анимация в центре */}
        <div className="flex flex-1 flex-col items-center gap-3">
          {/* Бегущая строка с шифром */}
          <div className="overflow-hidden rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-2.5 w-full">
            <div className="encrypt-scroll flex gap-3 text-[10px] font-mono text-violet-300/70">
              <span>AES-256-GCM</span>
              <span>·</span>
              <span>E2E</span>
              <span>·</span>
              <span>7f3a9b2e</span>
              <span>·</span>
              <span>SECURED</span>
              <span>·</span>
              <span>AES-256-GCM</span>
              <span>·</span>
              <span>E2E</span>
              <span>·</span>
              <span>7f3a9b2e</span>
              <span>·</span>
              <span>SECURED</span>
              <span>·</span>
              <span>AES-256-GCM</span>
              <span>·</span>
              <span>E2E</span>
              <span>·</span>
              <span>7f3a9b2e</span>
            </div>
          </div>

          {/* Иконка замка по центру */}
          <div className="lock-pulse flex h-12 w-12 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10">
            <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          {/* Сообщение летит */}
          <div className="relative h-6 w-full overflow-hidden">
            <div className="message-fly absolute left-0 top-0 flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-300 font-mono">msg_encrypted</span>
            </div>
          </div>
        </div>

        {/* Правое устройство — получатель */}
        <div className="flex flex-col items-center gap-3 min-w-[80px]">
          <div className="flex h-14 w-10 flex-col items-center justify-end gap-1 rounded-xl border border-white/15 bg-slate-800/80 pb-2 shadow-lg">
            <div className="h-1 w-5 rounded-full bg-emerald-400/60" />
            <div className="h-1 w-6 rounded-full bg-emerald-400/40" />
            <div className="h-1 w-4 rounded-full bg-emerald-400/50" />
          </div>
          <span className="text-[10px] text-slate-500 tracking-wider">RECEIVER</span>
        </div>

        {/* Угловые декоры */}
        <div className="pointer-events-none absolute left-3 top-3 h-3 w-3 rounded-tl-lg border-l border-t border-violet-500/30" />
        <div className="pointer-events-none absolute right-3 top-3 h-3 w-3 rounded-tr-lg border-r border-t border-violet-500/30" />
        <div className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 rounded-bl-lg border-b border-l border-violet-500/30" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 rounded-br-lg border-b border-r border-violet-500/30" />
      </div>

      {/* Подпись */}
      <p className="mt-4 text-center text-[11px] text-slate-500 tracking-widest uppercase">
        End-to-end encrypted · Zero knowledge
      </p>
    </div>
  );
}

// ─── Главная страница ─────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (accessToken) router.replace('/dashboard');
  }, [accessToken, router]);

  return (
    <>
      {/* Глобальные стили анимаций */}
      <style>{`
        @keyframes encrypt-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .encrypt-scroll {
          animation: encrypt-scroll 8s linear infinite;
          white-space: nowrap;
          width: max-content;
        }

        @keyframes message-fly {
          0%   { transform: translateX(-110%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateX(110%); opacity: 0; }
        }
        .message-fly {
          animation: message-fly 3s ease-in-out infinite;
        }

        @keyframes lock-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
        }
        .lock-pulse {
          animation: lock-pulse 2.5s ease-in-out infinite;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up-1 { animation: fade-up 0.7s ease both; }
        .fade-up-2 { animation: fade-up 0.7s 0.15s ease both; }
        .fade-up-3 { animation: fade-up 0.7s 0.3s ease both; }
        .fade-up-4 { animation: fade-up 0.7s 0.45s ease both; }
        .fade-up-5 { animation: fade-up 0.7s 0.6s ease both; }
      `}</style>

      <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#020617]">

        {/* Фоновые частицы */}
        <ParticleCanvas />

        {/* Фоновые градиенты */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/8 blur-[120px]" />
          <div className="absolute right-1/4 bottom-1/3 h-[300px] w-[300px] rounded-full bg-blue-600/6 blur-[100px]" />
        </div>

        {/* ── СЕКЦИЯ 1 — HERO ─────────────────────────────────────────────── */}
        <section className="relative flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">

          {/* Логотип */}
          <div className="fade-up-1 mb-8 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/connexy_icon.svg"
              alt="Connexy"
              width={72}
              height={72}
              className="drop-shadow-[0_0_24px_rgba(99,102,241,0.8)]"
            />
          </div>

          {/* Заголовок */}
          <h1 className="fade-up-2 text-5xl font-bold tracking-[0.35em] text-white sm:text-6xl lg:text-7xl">
            CONNEXY
          </h1>

          {/* Подзаголовок */}
          <p className="fade-up-3 mt-6 max-w-md text-base text-slate-400 leading-relaxed sm:text-lg">
            Приватное пространство для общения.<br />
            <span className="text-slate-300">Только те, кого вы выбрали.</span>
          </p>

          {/* Теги */}
          <div className="fade-up-4 mt-6 flex flex-wrap items-center justify-center gap-2">
            {['🔐 E2E шифрование', '🔗 Только по инвайту', '⚡ Реальное время'].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Кнопка */}
          <div className="fade-up-5 mt-10 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/auth/login')}
              className="group relative overflow-hidden rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-10 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all duration-300 hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] hover:scale-105 active:scale-95"
            >
              <span className="relative z-10">Войти</span>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-blue-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </button>
            <button
              type="button"
              onClick={() => router.push('/auth/no-invite')}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Нет аккаунта? Нужно приглашение →
            </button>
          </div>
        </section>

        {/* Разделитель */}
        <div className="relative mx-auto w-full max-w-lg px-4">
          <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
        </div>

        {/* ── СЕКЦИЯ 3 — АНИМАЦИЯ ШИФРОВАНИЯ ─────────────────────────────── */}
        <section className="relative px-4 py-16">
          <div className="mx-auto max-w-lg">
            {/* Заголовок секции */}
            <div className="mb-8 text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-600">
                Как это работает
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                Ваши сообщения защищены
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                AES-256-GCM шифрование · Ключи только у вас
              </p>
            </div>

            <EncryptionAnimation />
          </div>
        </section>

        {/* Footer */}
        <footer className="relative py-6 text-center">
          <p className="text-[11px] text-slate-700 tracking-widest uppercase">
            Connexy · Private connections, refined
          </p>
        </footer>

      </main>
    </>
  );
}
