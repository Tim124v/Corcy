'use client';

import { useId } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
    <Image
      src="/connexy_icon.svg"
      alt="Connexy"
      width={iconSize}
      height={iconSize}
      className="shrink-0"
      priority
    />
  );

  const text = (
    <Image
      src="/logo.svg"
      alt="Connexy"
      width={160}
      height={60}
      className={className}
      priority
    />
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
