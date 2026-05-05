'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth';

// ─── Частицы ──────────────────────────────────────────────────────────────
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
    const resize = () => { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; };
    window.addEventListener('resize', resize);
    const COUNT = Math.min(60, Math.floor((W * H) / 18000));
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
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
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(139,92,246,0.6)';
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

// ─── Typewriter ────────────────────────────────────────────────────────────
function Typewriter({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) return;
    const t = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, 38);
    return () => clearTimeout(t);
  }, [started, displayed, text]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="animate-pulse text-blue-400">|</span>
      )}
    </span>
  );
}

// ─── Анимация шифрования ──────────────────────────────────────────────────
function EncryptionAnimation() {
  return (
    <div className="relative mx-auto w-full max-w-md select-none px-4">
      <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03] p-5 backdrop-blur-sm">
        {/* Бегущая строка */}
        <div className="mb-4 overflow-hidden rounded-xl border border-violet-500/20 bg-violet-500/8 px-3 py-2">
          <div className="encrypt-scroll flex gap-3 text-[10px] font-mono text-violet-300/70 whitespace-nowrap w-max">
            <span>AES-256-GCM</span><span>·</span>
            <span>E2E</span><span>·</span>
            <span>7f3a9b2e</span><span>·</span>
            <span>SECURED</span><span>·</span>
            <span>AES-256-GCM</span><span>·</span>
            <span>E2E</span><span>·</span>
            <span>7f3a9b2e</span><span>·</span>
            <span>SECURED</span>
          </div>
        </div>
        {/* Устройства */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-8 flex-col items-center justify-end gap-1 rounded-lg border border-white/15 bg-slate-800/80 pb-2">
              <div className="h-1 w-5 rounded-full bg-blue-400/60" />
              <div className="h-1 w-3 rounded-full bg-blue-400/40" />
              <div className="h-1 w-4 rounded-full bg-blue-400/50" />
            </div>
            <span className="text-[9px] text-slate-500 tracking-wider">SENDER</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-3 px-2">
            <div className="lock-pulse flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10">
              <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="relative h-6 w-full overflow-hidden">
              <div className="message-fly absolute left-0 top-0 flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 whitespace-nowrap">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[9px] text-emerald-300 font-mono">encrypted</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-8 flex-col items-center justify-end gap-1 rounded-lg border border-white/15 bg-slate-800/80 pb-2">
              <div className="h-1 w-4 rounded-full bg-emerald-400/60" />
              <div className="h-1 w-5 rounded-full bg-emerald-400/40" />
              <div className="h-1 w-3 rounded-full bg-emerald-400/50" />
            </div>
            <span className="text-[9px] text-slate-500 tracking-wider">RECEIVER</span>
          </div>
        </div>
        {/* Угловые декоры */}
        <div className="pointer-events-none absolute left-3 top-3 h-3 w-3 rounded-tl-lg border-l border-t border-violet-500/30" />
        <div className="pointer-events-none absolute right-3 top-3 h-3 w-3 rounded-tr-lg border-r border-t border-violet-500/30" />
        <div className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 rounded-bl-lg border-b border-l border-violet-500/30" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 rounded-br-lg border-b border-r border-violet-500/30" />
      </div>
      <p className="mt-4 text-center text-[10px] text-slate-500 tracking-wider uppercase leading-relaxed">
        End-to-end encrypted<br />Zero knowledge
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

  const tags = [
    { icon: '🔐', label: 'E2E Encrypted' },
    { icon: '🔗', label: 'Invite Only' },
    { icon: '⚡', label: 'Real-time' },
  ];

  return (
    <>
      <style>{`
        @keyframes encrypt-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .encrypt-scroll { animation: encrypt-scroll 8s linear infinite; }

        @keyframes message-fly {
          0%   { transform: translateX(-110%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateX(110%); opacity: 0; }
        }
        .message-fly { animation: message-fly 3s ease-in-out infinite; }

        @keyframes lock-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
        }
        .lock-pulse { animation: lock-pulse 2.5s ease-in-out infinite; }

        @keyframes logo-glow {
          0%, 100% { filter: drop-shadow(0 0 16px rgba(99,102,241,0.7)); }
          50%       { filter: drop-shadow(0 0 32px rgba(139,92,246,1)); }
        }
        .logo-glow { animation: logo-glow 3s ease-in-out infinite; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up-1 { animation: fade-up 0.7s ease both; }
        .fade-up-2 { animation: fade-up 0.7s 0.2s ease both; }
        .fade-up-3 { animation: fade-up 0.7s 0.4s ease both; }
        .fade-up-4 { animation: fade-up 0.7s 0.6s ease both; }

        @keyframes tag-in {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .tag-0 { animation: tag-in 0.5s 0.7s ease both; }
        .tag-1 { animation: tag-in 0.5s 0.9s ease both; }
        .tag-2 { animation: tag-in 0.5s 1.1s ease both; }

        @keyframes fade-up-section {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .section-in { animation: fade-up-section 0.8s 0.3s ease both; }
      `}</style>

      <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#020617]">
        <ParticleCanvas />

        {/* Градиенты фона */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/8 blur-[120px]" />
          <div className="absolute right-1/4 bottom-1/3 h-[300px] w-[300px] rounded-full bg-blue-600/6 blur-[100px]" />
        </div>

        {/* ── HERO ── */}
        <section className="relative flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">

          {/* Логотип с пульсирующим свечением */}
          <div className="fade-up-1 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/connexy_icon.svg"
              alt="Connexy"
              width={70}
              height={70}
              className="logo-glow sm:w-[90px] sm:h-[90px]"
            />
          </div>

          {/* Заголовок */}
          <h1 className="fade-up-2 text-4xl font-bold tracking-[0.2em] text-white sm:text-5xl sm:tracking-[0.35em] lg:text-7xl">
            <span
              className="font-bold tracking-tight"
              style={{
                letterSpacing: '0.01em',
                background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 60%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Corsy
            </span>
          </h1>

          {/* Typewriter подзаголовок */}
          <p className="fade-up-3 mt-5 text-base text-slate-400 leading-relaxed sm:text-lg min-h-[56px]">
            <Typewriter text="Your private space for real connections." delay={600} />
            <br />
            <span className="text-slate-300 text-sm">
              <Typewriter text="Only the people you choose." delay={1800} />
            </span>
          </p>

          {/* Теги с поочерёдным появлением */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {tags.map((tag, i) => (
              <span
                key={tag.label}
                className={`tag-${i} rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 backdrop-blur-sm`}
              >
                {tag.icon} {tag.label}
              </span>
            ))}
          </div>

          {/* Кнопки */}
          <div className="fade-up-4 mt-10 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/auth/login')}
              className="group relative overflow-hidden rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-14 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all duration-300 hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] hover:scale-105 active:scale-95"
            >
              <span className="relative z-10">Sign In →</span>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-blue-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </button>

            <button
              type="button"
              onClick={() => router.push('/waitlist')}
              className="rounded-full border border-white/10 bg-white/5 px-8 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-200 backdrop-blur-sm"
            >
              Request Access
            </button>

            <p className="text-xs text-slate-600">
              Invite only · Private by design
            </p>
          </div>
        </section>

        {/* Разделитель */}
        <div className="mx-auto w-full max-w-lg px-4">
          <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
        </div>

        {/* ── ШИФРОВАНИЕ ── */}
        <section className="section-in relative px-4 py-14">
          <div className="mx-auto max-w-lg">
            <div className="mb-8 text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-600">
                How it works
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                Your messages are protected
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                AES-256-GCM encryption · Your keys, your data
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
