import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 16;
const ENC = 'base64';

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
  version: number;
};

const KEY_STORE: Record<number, Buffer> = {};

function loadKeyStore(): void {
  let v = 1;
  for (;;) {
    const hex = process.env[`MESSAGE_ENCRYPTION_KEY_V${v}`]?.trim();
    if (!hex) break;
    const buf = Buffer.from(hex, 'hex');
    if (buf.length === KEY_LEN) KEY_STORE[v] = buf;
    v += 1;
  }
  const currentHex = process.env.MESSAGE_ENCRYPTION_KEY?.trim();
  if (currentHex) {
    const buf = Buffer.from(currentHex, 'hex');
    if (buf.length === KEY_LEN) {
      const nextV = Math.max(0, ...Object.keys(KEY_STORE).map(Number), 0) + 1;
      KEY_STORE[nextV] = buf;
    }
  }
}

loadKeyStore();

function currentEncryptVersion(): number {
  const keys = Object.keys(KEY_STORE).map(Number).filter((n) => n > 0);
  if (!keys.length) return 1;
  return Math.max(...keys);
}

export function isEncryptionEnabled(): boolean {
  return Object.keys(KEY_STORE).length > 0;
}

export function encryptString(plaintext: string): string {
  if (!isEncryptionEnabled()) return plaintext;
  const version = currentEncryptVersion();
  const key = KEY_STORE[version];
  if (!key) return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv) as import('crypto').CipherGCM;
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedPayload = {
    ciphertext: ciphertext.toString(ENC),
    iv: iv.toString(ENC),
    tag: tag.toString(ENC),
    version,
  };
  return JSON.stringify(payload);
}

/** Расшифровка по версии ключа (ротация MESSAGE_ENCRYPTION_KEY_Vn + текущий ключ). */
export function decryptWithVersion(payload: EncryptedPayload): string {
  const version = payload.version || 1;
  const key = KEY_STORE[version];
  if (!key) {
    throw new Error(`Нет ключа для версии шифрования ${version}`);
  }
  const iv = Buffer.from(payload.iv, ENC);
  const tag = Buffer.from(payload.tag, ENC);
  const ciphertext = Buffer.from(payload.ciphertext, ENC);
  const decipher = createDecipheriv(ALGORITHM, key, iv) as import('crypto').DecipherGCM;
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function decryptString(stored: string): string {
  if (!isEncryptionEnabled()) return stored;
  try {
    const payload = JSON.parse(stored) as EncryptedPayload;
    if (!payload?.ciphertext || !payload.iv || !payload.tag) return stored;
    return decryptWithVersion(payload);
  } catch {
    return stored;
  }
}

export function looksEncryptedJson(value: string): boolean {
  try {
    const o = JSON.parse(value) as EncryptedPayload;
    return typeof o?.ciphertext === 'string' && typeof o?.iv === 'string' && typeof o?.tag === 'string';
  } catch {
    return false;
  }
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
