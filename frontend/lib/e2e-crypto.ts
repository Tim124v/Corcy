/**
 * E2E шифрование: X25519 + XSalsa20-Poly1305 (NaCl box).
 * Формат: e2e:{nonce_hex}:{ciphertext_base64}
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

const E2E_PREFIX = 'e2e:';

export function generateKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return nacl.box.keyPair();
}

export async function deriveMasterKey(userId: string, password: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const rawKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(`connexy-e2e-${userId}`),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    rawKey,
    256,
  );
  return new Uint8Array(bits);
}

export function encryptPrivateKey(secretKey: Uint8Array, masterKey: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encrypted = nacl.secretbox(secretKey, nonce, masterKey);
  return `${encodeBase64(nonce)}:${encodeBase64(encrypted)}`;
}

export function decryptPrivateKey(encrypted: string, masterKey: Uint8Array): Uint8Array | null {
  try {
    const [nonceB64, ctB64] = encrypted.split(':');
    if (!nonceB64 || !ctB64) return null;
    const nonce = decodeBase64(nonceB64);
    const ciphertext = decodeBase64(ctB64);
    return nacl.secretbox.open(ciphertext, nonce, masterKey) ?? null;
  } catch {
    return null;
  }
}

const PUBKEY_LSKEY = (userId: string) => `connexy-e2e-pub:${userId}`;
const ENCPRIV_LSKEY = (userId: string) => `connexy-e2e-priv-enc:${userId}`;

export function saveKeysLocally(
  userId: string,
  publicKey: Uint8Array,
  encryptedPrivateKey: string,
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PUBKEY_LSKEY(userId), encodeBase64(publicKey));
  localStorage.setItem(ENCPRIV_LSKEY(userId), encryptedPrivateKey);
}

export function loadLocalPublicKey(userId: string): Uint8Array | null {
  if (typeof window === 'undefined') return null;
  const b64 = localStorage.getItem(PUBKEY_LSKEY(userId));
  return b64 ? decodeBase64(b64) : null;
}

export function loadEncryptedPrivateKey(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ENCPRIV_LSKEY(userId));
}

export function clearLocalKeys(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PUBKEY_LSKEY(userId));
  localStorage.removeItem(ENCPRIV_LSKEY(userId));
}

export function encryptMessage(
  plaintext: string,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array,
): string {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = utf8Encoder.encode(plaintext);
  const encrypted = nacl.box(messageUint8, nonce, recipientPublicKey, senderSecretKey);
  const nonceHex = Array.from(nonce)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${E2E_PREFIX}${nonceHex}:${encodeBase64(encrypted)}`;
}

export function decryptMessage(
  stored: string,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array,
): string | null {
  if (!stored.startsWith(E2E_PREFIX)) return null;
  try {
    const payload = stored.slice(E2E_PREFIX.length);
    const [nonceHex, ctB64] = payload.split(':');
    if (!nonceHex || !ctB64) return null;
    const nonce = new Uint8Array(nonceHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    const ciphertext = decodeBase64(ctB64);
    const decrypted = nacl.box.open(ciphertext, nonce, senderPublicKey, recipientSecretKey);
    return decrypted ? utf8Decoder.decode(decrypted) : null;
  } catch {
    return null;
  }
}

export function isE2EMessage(text: string): boolean {
  return text.startsWith(E2E_PREFIX);
}
