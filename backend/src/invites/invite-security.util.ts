import * as crypto from 'crypto';

export const InviteTokenUtil = {
  generate(): string {
    return crypto.randomBytes(32).toString('base64url');
  },

  hash(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
  },

  verify(rawToken: string, storedHash: string): boolean {
    const hash = InviteTokenUtil.hash(rawToken);
    const hashBuf = Buffer.from(hash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (hashBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, storedBuf);
  },
};
