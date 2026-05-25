import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'connexy_refresh_token';
const USER_KEY = 'connexy_user';

export const SecureStorage = {
  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  },

  async clearRefreshToken(): Promise<void> {
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
  },

  async getUser(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(USER_KEY);
    } catch {
      return null;
    }
  },

  async setUser(user: object): Promise<void> {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async clearUser(): Promise<void> {
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
  },
};
