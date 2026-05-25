import { API_URL } from '../constants/api';
import { useAuthStore, type User } from '../store/auth';

const MOBILE_HEADERS = { 'X-Client': 'mobile' };

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const { refreshToken, setAuth, logout } = useAuthStore.getState();
      if (!refreshToken) return false;

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...MOBILE_HEADERS,
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok: boolean;
        accessToken?: string;
        refreshToken?: string;
        user?: User;
      } | null;

      if (!res.ok || !data?.ok || !data.accessToken) {
        await logout();
        return false;
      }

      await setAuth(
        data.user ?? useAuthStore.getState().user!,
        data.accessToken,
        data.refreshToken ?? useAuthStore.getState().refreshToken ?? '',
      );
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function api<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, ...rest } = options;
  const token = useAuthStore.getState().accessToken;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...MOBILE_HEADERS,
    ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
    ...rest.headers,
  };

  let res = await fetch(`${API_URL}${path}`, { ...rest, headers });

  if (
    res.status === 401 &&
    !skipAuth &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/refresh') &&
    !path.startsWith('/auth/verify-email')
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      const newToken = useAuthStore.getState().accessToken;
      res = await fetch(`${API_URL}${path}`, {
        ...rest,
        headers: {
          ...headers,
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
        },
      });
    }
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message?: string | string[];
      error?: string;
    };
    const msg =
      (Array.isArray(err.message) ? err.message.join(', ') : err.message) ??
      err.error ??
      res.statusText;
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}
