import { getAccessToken, useAuthStore } from '../store/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let refreshInFlight: Promise<boolean> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  opts?: { timeoutMs?: number; retries?: number; retryDelayMs?: number },
): Promise<Response> {
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const retries = opts?.retries ?? 1;
  const retryDelayMs = opts?.retryDelayMs ?? 1500;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(input, init, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      await sleep(retryDelayMs);
    }
  }
  throw lastErr;
}

async function tryRefreshAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json().catch(() => null) : null;
      if (!res.ok || !data?.ok || !data.accessToken) {
        return false;
      }
      // accessToken держим в памяти: обновляем и store, и модульный _accessToken.
      useAuthStore.getState().setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = options;
  const buildHeaders = (): HeadersInit => {
    const auth =
      token !== undefined
        ? token
        : typeof window !== 'undefined'
          ? getAccessToken() || ''
          : '';
    return {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...rest.headers,
    };
  };

  let res = await fetchWithRetry(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: buildHeaders(),
  });

  if (
    res.status === 401 &&
    typeof window !== 'undefined' &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/register') &&
    !path.startsWith('/auth/refresh') &&
    !path.startsWith('/auth/verify-email') &&
    !path.startsWith('/auth/2fa/challenge')
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      res = await fetchWithRetry(`${API_URL}${path}`, {
        ...rest,
        credentials: 'include',
        headers: buildHeaders(),
      });
    }
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    const err = isJson
      ? await res.json().catch(() => ({ message: res.statusText }))
      : { message: res.statusText };
    const msg =
      (err as { error?: string; message?: string }).error ||
      (err as { message?: string }).message ||
      res.statusText;
    throw new Error(msg);
  }

  if (!isJson) {
    const text = await res.text();
    if (text.trimStart().startsWith('<'))
      throw new Error('Сервер вернул страницу вместо данных. Проверьте, что бэкенд запущен на ' + API_URL);
    throw new Error('Сервер вернул неверный формат ответа');
  }
  return res.json() as Promise<T>;
}
