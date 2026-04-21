/** In-memory кэш (не переживает F5). Refresh — httpOnly cookie; access в localStorage — см. store/auth и lib/api. */
const mem = { accessToken: null as string | null, refreshToken: null as string | null };

export const SecureStorage = {
  setTokens(access: string, refresh: string) {
    mem.accessToken = access;
    mem.refreshToken = refresh;
  },
  getAccessToken() {
    return mem.accessToken;
  },
  getRefreshToken() {
    return mem.refreshToken;
  },
  clearTokens() {
    mem.accessToken = null;
    mem.refreshToken = null;
  },
};
