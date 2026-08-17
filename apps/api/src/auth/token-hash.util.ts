import { createHash } from 'node:crypto';

/**
 * Refresh tokens are high-entropy random values, not low-entropy secrets like
 * passwords — a fast cryptographic hash (not bcrypt) is the right tool here;
 * bcrypt's deliberate slowness exists to resist brute-forcing weak passwords,
 * which doesn't apply to a 256-bit random token.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
