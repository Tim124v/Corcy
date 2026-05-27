export const initials = (name?: string | null, email?: string): string => {
  if (name && name.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join('');
  }
  if (email) return email[0]?.toUpperCase() || '?';
  return '?';
};

export const avatarColors = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-blue-500',
] as const;

export const getAvatarGradient = (userId: string): string => {
  let n = 0;
  for (let i = 0; i < userId.length; i++) n += userId.charCodeAt(i);
  return avatarColors[Math.abs(n) % avatarColors.length];
};

export const decodeAttachmentName = (value?: string | null): string => {
  if (!value) return '';
  if (!/[ÐÑ]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0)));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    const originalNoise = (value.match(/[ÐÑ]/g) || []).length;
    const decodedNoise = (decoded.match(/[ÐÑ]/g) || []).length;
    return decodedNoise < originalNoise ? decoded : value;
  } catch {
    return value;
  }
};

export const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export const formatRelativeTime = (
  dateString: string | undefined,
  now: number,
  isEn: boolean,
): string => {
  if (!dateString) return isEn ? 'recently' : 'недавно';
  const diff = Math.max(0, now - new Date(dateString).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60)
    return isEn
      ? `${Math.max(1, minutes)} min ago`
      : `${Math.max(1, minutes)} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return isEn ? `${hours} hour${hours > 1 ? 's' : ''} ago` : `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return isEn
    ? days === 1
      ? 'Yesterday'
      : `${days} days ago`
    : days === 1
      ? 'Вчера'
      : `${days} д назад`;
};

export const getLatestIncomingTimestamp = <
  T extends { senderId: string; createdAt: string },
>(
  items: T[],
  currentUserId?: string,
): string | null => {
  if (!currentUserId) return null;
  const latestIncoming = [...items]
    .reverse()
    .find((item) => item.senderId !== currentUserId);
  return latestIncoming?.createdAt || null;
};

export const isTimestampNewer = (
  nextTimestamp: string | null,
  prevTimestamp?: string,
): boolean => {
  if (!nextTimestamp) return false;
  if (!prevTimestamp) return true;
  return new Date(nextTimestamp).getTime() > new Date(prevTimestamp).getTime();
};

