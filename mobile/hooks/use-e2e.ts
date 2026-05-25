import { useCallback } from 'react';
import {
  generateKeyPair,
  deriveMasterKey,
  encryptPrivateKey,
  decryptPrivateKey,
  storeKeys,
  loadStoredPublicKey,
  loadStoredEncryptedPriv,
  deleteStoredKeys,
  encryptMessage,
  decryptMessage,
  isE2EMessage,
  publicKeyToBase64,
  base64ToPublicKey,
} from '../lib/e2e-crypto-mobile';
import { api } from '../lib/api';

type E2EKeys = { publicKey: Uint8Array; secretKey: Uint8Array };

let inMemoryKeys: E2EKeys | null = null;
const peerKeyCache = new Map<string, Uint8Array | null>();
let pendingPasswordForE2E: string | null = null;

export function clearE2ESession(): void {
  inMemoryKeys = null;
  peerKeyCache.clear();
}

/** Сохранить пароль перед редиректом на 2FA (пароль нужен для расшифровки ключей). */
export function stashPasswordForE2E(password: string): void {
  pendingPasswordForE2E = password;
}

export function takePasswordForE2E(): string | null {
  const p = pendingPasswordForE2E;
  pendingPasswordForE2E = null;
  return p;
}

export async function initializeE2EStandalone(
  userId: string,
  password: string,
): Promise<boolean> {
  if (!password) return false;
  try {
    const masterKey = await deriveMasterKey(userId, password);
    const encryptedPriv = await loadStoredEncryptedPriv(userId);

    if (encryptedPriv) {
      const secretKey = decryptPrivateKey(encryptedPriv, masterKey);
      const publicKey = await loadStoredPublicKey(userId);
      if (secretKey && publicKey) {
        inMemoryKeys = { publicKey, secretKey };
        return true;
      }
      await deleteStoredKeys(userId);
    }

    const keyPair = generateKeyPair();
    const encPriv = encryptPrivateKey(keyPair.secretKey, masterKey);
    await storeKeys(userId, keyPair.publicKey, encPriv);
    inMemoryKeys = { publicKey: keyPair.publicKey, secretKey: keyPair.secretKey };

    await api('/users/me/e2e-key', {
      method: 'POST',
      body: JSON.stringify({ publicKey: publicKeyToBase64(keyPair.publicKey) }),
    });

    return true;
  } catch {
    return false;
  }
}

export function useE2EMobile(userId: string | undefined) {
  const isE2EReady = useCallback((): boolean => {
    return inMemoryKeys !== null;
  }, []);

  const getPeerPublicKey = useCallback(async (peerId: string): Promise<Uint8Array | null> => {
    if (peerKeyCache.has(peerId)) return peerKeyCache.get(peerId) ?? null;
    try {
      const res = await api<{ publicKey: string | null }>(`/users/${peerId}/e2e-key`);
      const key = res.publicKey ? base64ToPublicKey(res.publicKey) : null;
      peerKeyCache.set(peerId, key);
      return key;
    } catch {
      return null;
    }
  }, []);

  const encryptForPeer = useCallback(
    async (plaintext: string, peerId: string): Promise<{ text: string; isE2E: boolean }> => {
      if (!inMemoryKeys) return { text: plaintext, isE2E: false };
      const peerKey = await getPeerPublicKey(peerId);
      if (!peerKey) return { text: plaintext, isE2E: false };
      return {
        text: encryptMessage(plaintext, peerKey, inMemoryKeys.secretKey),
        isE2E: true,
      };
    },
    [getPeerPublicKey],
  );

  const decryptInContext = useCallback(
    async (stored: string, senderId: string, peerId: string): Promise<string> => {
      if (!isE2EMessage(stored)) return stored;
      if (!inMemoryKeys || !userId) return '[E2E: ключи не загружены]';

      const otherPartyId = senderId === userId ? peerId : senderId;
      const otherKey = await getPeerPublicKey(otherPartyId);
      if (!otherKey) return '[E2E: ключ недоступен]';

      return decryptMessage(stored, otherKey, inMemoryKeys.secretKey) ?? '[E2E: ошибка расшифровки]';
    },
    [getPeerPublicKey, userId],
  );

  return { isE2EReady, getPeerPublicKey, encryptForPeer, decryptInContext };
}
