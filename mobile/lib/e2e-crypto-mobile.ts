/**
 * E2E шифрование для React Native.
 * Алгоритм: X25519 + XSalsa20-Poly1305 (NaCl Box, tweetnacl).
 * Формат хранимого сообщения: e2e:{nonce_hex}:{ciphertext_base64}
 */

import nacl from 'tweetnacl';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const E2E_PREFIX = 'e2e:';

function u8ToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

function base64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function u8ToHex(arr: Uint8Array): string {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToU8(hex: string): Uint8Array {
  const pairs = hex.match(/.{2}/g) ?? [];
  return new Uint8Array(pairs.map((h) => parseInt(h, 16)));
}

export function generateKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return nacl.box.keyPair();
}

export function publicKeyToBase64(key: Uint8Array): string {
  return u8ToBase64(key);
}

export function base64ToPublicKey(b64: string): Uint8Array {
  return base64ToU8(b64);
}

export async function deriveMasterKey(userId: string, password: string): Promise<Uint8Array> {
  const passHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  const combined = `${passHash}:${userId}:connexy-e2e-v1`;
  const masterHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return hexToU8(masterHex);
}

export function encryptPrivateKey(secretKey: Uint8Array, masterKey: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ct = nacl.secretbox(secretKey, nonce, masterKey);
  return `${u8ToBase64(nonce)}:${u8ToBase64(ct)}`;
}

export function decryptPrivateKey(
  encrypted: string,
  masterKey: Uint8Array,
): Uint8Array | null {
  try {
    const [nonceB64, ctB64] = encrypted.split(':');
    if (!nonceB64 || !ctB64) return null;
    const result = nacl.secretbox.open(base64ToU8(ctB64), base64ToU8(nonceB64), masterKey);
    return result ?? null;
  } catch {
    return null;
  }
}

const KEY_PRIV = (uid: string) => `cx-e2e-priv:${uid}`;
const KEY_PUB = (uid: string) => `cx-e2e-pub:${uid}`;

export async function storeKeys(
  userId: string,
  publicKey: Uint8Array,
  encryptedPriv: string,
): Promise<void> {
  await SecureStore.setItemAsync(KEY_PUB(userId), u8ToBase64(publicKey));
  await SecureStore.setItemAsync(KEY_PRIV(userId), encryptedPriv);
}

export async function loadStoredPublicKey(userId: string): Promise<Uint8Array | null> {
  const b64 = await SecureStore.getItemAsync(KEY_PUB(userId));
  return b64 ? base64ToU8(b64) : null;
}

export async function loadStoredEncryptedPriv(userId: string): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_PRIV(userId));
}

export async function deleteStoredKeys(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PUB(userId)).catch(() => {});
  await SecureStore.deleteItemAsync(KEY_PRIV(userId)).catch(() => {});
}

export function encryptMessage(
  plaintext: string,
  recipientPub: Uint8Array,
  senderSec: Uint8Array,
): string {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ct = nacl.box(new TextEncoder().encode(plaintext), nonce, recipientPub, senderSec);
  return `${E2E_PREFIX}${u8ToHex(nonce)}:${u8ToBase64(ct)}`;
}

export function decryptMessage(
  stored: string,
  senderPub: Uint8Array,
  recipientSec: Uint8Array,
): string | null {
  if (!stored.startsWith(E2E_PREFIX)) return null;
  try {
    const [nonceHex, ctB64] = stored.slice(E2E_PREFIX.length).split(':');
    if (!nonceHex || !ctB64) return null;
    const plain = nacl.box.open(base64ToU8(ctB64), hexToU8(nonceHex), senderPub, recipientSec);
    return plain ? new TextDecoder().decode(plain) : null;
  } catch {
    return null;
  }
}

export function isE2EMessage(text: string): boolean {
  return text.startsWith(E2E_PREFIX);
}
