'use client';

import { useCallback, useEffect, useRef } from 'react';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import {
  generateKeyPair,
  deriveMasterKey,
  encryptPrivateKey,
  decryptPrivateKey,
  saveKeysLocally,
  loadLocalPublicKey,
  loadEncryptedPrivateKey,
  clearLocalKeys,
  encryptMessage,
  decryptMessage,
  isE2EMessage,
} from '../lib/e2e-crypto';
import { api } from '../lib/api';

type E2EKeys = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

let inMemoryKeys: E2EKeys | null = null;
const peerPublicKeyCache = new Map<string, Uint8Array | null>();

export function isE2EReady(): boolean {
  return inMemoryKeys !== null;
}

export async function initializeE2EKeys(userId: string, password: string): Promise<boolean> {
  try {
    const masterKey = await deriveMasterKey(userId, password);
    const encryptedPriv = loadEncryptedPrivateKey(userId);

    if (encryptedPriv) {
      const secretKey = decryptPrivateKey(encryptedPriv, masterKey);
      const publicKey = loadLocalPublicKey(userId);
      if (secretKey && publicKey) {
        inMemoryKeys = { publicKey, secretKey };
        return true;
      }
    }

    const keyPair = generateKeyPair();
    const encPriv = encryptPrivateKey(keyPair.secretKey, masterKey);
    saveKeysLocally(userId, keyPair.publicKey, encPriv);
    inMemoryKeys = { publicKey: keyPair.publicKey, secretKey: keyPair.secretKey };

    await api('/users/me/e2e-key', {
      method: 'POST',
      body: JSON.stringify({ publicKey: encodeBase64(keyPair.publicKey) }),
    });

    return true;
  } catch {
    return false;
  }
}

export function clearE2ESession(): void {
  inMemoryKeys = null;
  peerPublicKeyCache.clear();
}

export function useE2E(userId: string | undefined) {
  const initializingRef = useRef(false);

  const initializeE2E = useCallback(
    async (password: string): Promise<boolean> => {
      if (!userId || initializingRef.current) return false;
      initializingRef.current = true;
      try {
        return await initializeE2EKeys(userId, password);
      } finally {
        initializingRef.current = false;
      }
    },
    [userId],
  );

  const isE2EReadyFn = useCallback((): boolean => isE2EReady(), []);

  const getPeerPublicKey = useCallback(async (peerId: string): Promise<Uint8Array | null> => {
    if (peerPublicKeyCache.has(peerId)) return peerPublicKeyCache.get(peerId) ?? null;
    try {
      const res = await api<{ publicKey: string | null }>(`/users/${peerId}/e2e-key`);
      if (!res.publicKey) {
        peerPublicKeyCache.set(peerId, null);
        return null;
      }
      const key = decodeBase64(res.publicKey);
      peerPublicKeyCache.set(peerId, key);
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
      const encrypted = encryptMessage(plaintext, peerKey, inMemoryKeys.secretKey);
      return { text: encrypted, isE2E: true };
    },
    [getPeerPublicKey],
  );

  const decryptInContext = useCallback(
    async (stored: string, senderId: string, peerId: string): Promise<string> => {
      if (!isE2EMessage(stored)) return stored;
      if (!inMemoryKeys || !userId) return '[E2E: ключи не загружены]';

      const isOutgoing = senderId === userId;
      const otherPartyId = isOutgoing ? peerId : senderId;

      const otherKey = await getPeerPublicKey(otherPartyId);
      if (!otherKey) return '[E2E: ключ недоступен]';

      const decrypted = decryptMessage(stored, otherKey, inMemoryKeys.secretKey);
      return decrypted ?? '[E2E: не удалось расшифровать]';
    },
    [getPeerPublicKey, userId],
  );

  const resetKeys = useCallback(
    async (password: string): Promise<boolean> => {
      if (!userId) return false;
      clearLocalKeys(userId);
      inMemoryKeys = null;
      peerPublicKeyCache.clear();
      return initializeE2EKeys(userId, password);
    },
    [userId],
  );

  useEffect(() => {
    return () => {};
  }, []);

  return {
    initializeE2E,
    isE2EReady: isE2EReadyFn,
    encryptForPeer,
    decryptInContext,
    getPeerPublicKey,
    resetKeys,
  };
}
