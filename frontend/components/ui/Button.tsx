import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-blue-600 to-violet-600
    hover:from-blue-500 hover:to-violet-500
    text-white shadow-lg shadow-blue-500/20
    disabled:from-blue-800 disabled:to-violet-800 disabled:shadow-none
  `,
  secondary: `
    bg-white/5 border border-white/10
    hover:bg-white/10 hover:border-white/20
    text-slate-200
  `,
  ghost: `
    hover:bg-white/5
    text-slate-400 hover:text-white
  `,
  danger: `
    bg-rose-500/10 border border-rose-500/20
    hover:bg-rose-500/20
    text-rose-300 hover:text-rose-200
  `,
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3.5 text-base rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'font-medium transition-all duration-150',
        'flex items-center justify-center gap-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/40',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Загрузка...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

