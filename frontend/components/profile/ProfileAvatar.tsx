'use client';

type ProfileAvatarProps = {
  src?: string | null;
  alt?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  sm: 'w-12 h-12 text-base',
  md: 'w-20 h-20 text-2xl',
  lg: 'w-28 h-28 text-3xl',
};

export function ProfileAvatar({ src, alt = '', initials = '?', size = 'lg', className = '' }: ProfileAvatarProps) {
  const sizeClass = sizeClasses[size];

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`rounded-full object-cover ring-2 ring-white/20 dark:ring-slate-600 shadow-xl ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-semibold text-white shadow-xl ring-2 ring-white/20 dark:ring-slate-600 ${sizeClass} ${className}`}
      aria-label={alt || 'Аватар'}
    >
      {initials}
    </div>
  );
}
