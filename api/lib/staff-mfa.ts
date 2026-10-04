import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newTotpSecret(): string {
  let bits = 0, value = 0, result = '';
  for (const byte of randomBytes(20)) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { result += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return result;
}
function decode(secret: string): Buffer {
  let bits = 0, value = 0; const bytes: number[] = [];
  for (const char of secret) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('Invalid authenticator secret');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}
export function totpCode(secret: string, counter: number): string {
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
export function verifyTotp(secret: string, code: string, lastCounter: number | null, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30_000);
  for (const counter of [current, current - 1, current + 1]) {
    if (counter < 0 || (lastCounter !== null && counter <= lastCounter)) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secret, counter)), Buffer.from(code))) return counter;
  }
  return null;
}

type Challenge = { staffId: number; secret: string; enrolling: boolean; passwordHash: string; expires: number; attempts: number };
const challenges = new Map<string, Challenge>();
export function createMfaChallenge(input: Omit<Challenge, 'expires' | 'attempts'>): string {
  for (const [key, value] of challenges) if (value.expires <= Date.now()) challenges.delete(key);
  const token = randomBytes(32).toString('hex');
  challenges.set(token, { ...input, expires: Date.now() + 5 * 60_000, attempts: 0 });
  return token;
}
export function consumeMfaAttempt(token: string): Challenge | null {
  const value = challenges.get(token);
  if (!value || value.expires <= Date.now() || value.attempts >= 5) { challenges.delete(token); return null; }
  value.attempts += 1;
  return value;
}
export function deleteMfaChallenge(token: string): void { challenges.delete(token); }
export function revokeMfaChallenges(staffId: number): void {
  for (const [token, value] of challenges) if (value.staffId === staffId) challenges.delete(token);
}
