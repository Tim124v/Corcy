import { createHmac, randomBytes } from 'crypto';
import { compare as bcryptCompare, hash as bcryptHash } from 'bcrypt';

function applyPepper(password: string): string {
  const pepper = process.env.PEPPER_SECRET;
  if (!pepper) return password;
  return createHmac('sha256', pepper).update(password).digest('hex');
}

function rounds(): number {
  const n = Number(process.env.BCRYPT_ROUNDS);
  return Number.isFinite(n) && n >= 10 && n <= 14 ? n : 12;
}

export async function hashPassword(plain: string): Promise<string> {
  const input = applyPepper(plain);
  return bcryptHash(input, rounds());
}

/** Совместимость: сначала pepper+bcrypt, затем старый только bcrypt. */
export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  if (process.env.PEPPER_SECRET) {
    if (await bcryptCompare(applyPepper(plain), storedHash)) return true;
  }
  return bcryptCompare(plain, storedHash);
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Минимум 8 символов');
  if (!/[A-Z]/.test(password)) errors.push('Нужна хотя бы одна заглавная буква');
  if (!/[a-z]/.test(password)) errors.push('Нужна хотя бы одна строчная буква');
  if (!/[0-9]/.test(password)) errors.push('Нужна хотя бы одна цифра');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Нужен хотя бы один спецсимвол');
  return { valid: errors.length === 0, errors };
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(4).toString('hex').toUpperCase());
}
