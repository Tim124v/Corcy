'use client';

import { useId } from 'react';
import Link from 'next/link';

type LogoProps = {
  variant?: 'full' | 'icon';
  layout?: 'stack' | 'inline';
  href?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeMap = {
  sm: { icon: 32, text: 'text-sm' },
  md: { icon: 48, text: 'text-lg' },
  lg: { icon: 64, text: 'text-2xl' },
};

export function Logo({ variant = 'full', layout = 'stack', href = '/', className = '', size = 'md' }: LogoProps) {
  const id = useId().replace(/:/g, '');
  const { icon: iconSize, text: textSize } = sizeMap[size];

  const icon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 320"
      className="shrink-0"
      style={{ width: iconSize, height: (iconSize * 320) / 256 }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-gradient`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id={`${id}-gradient-subtle`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feFlood floodColor="#3B82F6" floodOpacity="0.4" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-outer-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feFlood floodColor="#8B5CF6" floodOpacity="0.35" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon
        points="128,32 176,56 176,104 128,128 80,104 80,56"
        fill="none"
        stroke={`url(#${id}-gradient)`}
        strokeWidth="2"
        strokeOpacity="0.6"
        filter={`url(#${id}-outer-glow)`}
      />
      <polygon
        points="128,52 164,70 164,98 128,116 92,98 92,70"
        fill={`url(#${id}-gradient)`}
        fillOpacity="0.9"
        stroke={`url(#${id}-gradient-subtle)`}
        strokeWidth="1.5"
        filter={`url(#${id}-glow)`}
      />
      <line x1="128" y1="56" x2="128" y2="70" stroke={`url(#${id}-gradient-subtle)`} strokeWidth="1" opacity="0.8" />
    </svg>
  );

  const text = (
    <span
      className={`font-bold uppercase tracking-[0.35em] bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent ${textSize}`}
    >
      CONNEXY
    </span>
  );

  const content = (
    <span
      className={
        layout === 'inline'
          ? `inline-flex flex-row items-center gap-2 ${className}`
          : `inline-flex flex-col items-center gap-1 ${className}`
      }
    >
      {icon}
      {variant === 'full' && text}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex transition opacity-90 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 dark:focus:ring-offset-slate-950 rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}
