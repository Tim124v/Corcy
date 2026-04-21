import type { EncryptedPayload } from './encryption.util.js';
import { decryptWithVersion, encryptString, looksEncryptedJson } from './encryption.util.js';

export function prepareMessageForStorage(text: string): string {
  if (!text || text.trim() === '') return text;
  return encryptString(text);
}

export function prepareMessageForApi(stored: string): string {
  if (!stored) return stored;
  if (looksEncryptedJson(stored)) {
    try {
      const payload = JSON.parse(stored) as EncryptedPayload;
      return decryptWithVersion(payload);
    } catch {
      return '[Сообщение повреждено или ключ изменён]';
    }
  }
  return stored;
}

export function mapMessagesText<T extends { text: string }>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r, text: prepareMessageForApi(r.text) }));
}
