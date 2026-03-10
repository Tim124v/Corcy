'use client';

import { useEffect, useState } from 'react';

const PROFILE_PHOTO_EVENT = 'connexy-profile-photo-updated';

const getProfilePhotoKey = (userId: string) => `connexy-profile-photo:${userId}`;

export const getStoredUserAvatar = (userId?: string | null) => {
  if (typeof window === 'undefined' || !userId) return null;
  return localStorage.getItem(getProfilePhotoKey(userId));
};

export const setStoredUserAvatar = (userId: string, avatar: string | null) => {
  if (typeof window === 'undefined') return;
  const key = getProfilePhotoKey(userId);
  if (avatar) {
    localStorage.setItem(key, avatar);
  } else {
    localStorage.removeItem(key);
  }
  window.dispatchEvent(
    new CustomEvent(PROFILE_PHOTO_EVENT, {
      detail: { userId, avatar },
    }),
  );
};

export function useCurrentUserAvatar(userId?: string | null, fallbackAvatar?: string | null) {
  const [avatar, setAvatar] = useState<string | null>(() => getStoredUserAvatar(userId) || fallbackAvatar || null);

  useEffect(() => {
    const stored = getStoredUserAvatar(userId);
    setAvatar(stored || fallbackAvatar || null);
    if (!stored && userId && fallbackAvatar) {
      setStoredUserAvatar(userId, fallbackAvatar);
    }
  }, [userId, fallbackAvatar]);

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === getProfilePhotoKey(userId)) {
        setAvatar(event.newValue);
      }
    };

    const handleCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string; avatar?: string | null }>;
      if (customEvent.detail?.userId === userId) {
        setAvatar(customEvent.detail.avatar ?? null);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(PROFILE_PHOTO_EVENT, handleCustomUpdate as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(PROFILE_PHOTO_EVENT, handleCustomUpdate as EventListener);
    };
  }, [userId]);

  return avatar;
}
