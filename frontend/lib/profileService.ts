import { api } from './api';

export type ProfileUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
};

export type PostItem = {
  id: string;
  title?: string;
  body?: string;
  createdAt?: string;
  imageUrl?: string | null;
};

/**
 * Получить профиль пользователя.
 * Backend предоставляет только GET /users/me — для просмотра по id поддерживается только текущий пользователь (id === 'me' или id === currentUserId).
 */
export async function getProfile(userId: string | null, accessToken: string | null): Promise<ProfileUser | null> {
  if (!accessToken) return null;
  try {
    const data = await api<ProfileUser>('/users/me');
    if (userId && userId !== 'me' && data.id !== userId) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Публикации пользователя.
 * Backend не предоставляет GET /api/posts?userId= — возвращаем пустой массив до появления API.
 */
export async function getUserPosts(_userId: string): Promise<PostItem[]> {
  return [];
}
