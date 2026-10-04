import { createHmac, timingSafeEqual } from 'node:crypto';

/** Raw-body Svix v1 protocol: https://docs.svix.com/receiving/verifying-payloads/how-manual */
export function verifyEmailSignature(raw: string, headers: Headers, secret: string, now = Date.now()): string {
  const id = headers.get('svix-id') || '', timestamp = headers.get('svix-timestamp') || '';
  if (!secret.startsWith('whsec_') || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) throw new Error('Invalid email webhook authentication');
  const key = Buffer.from(secret.slice(6), 'base64');
  if (key.length < 16) throw new Error('Invalid email webhook key');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest();
  const valid = (headers.get('svix-signature') || '').split(' ').some(part => {
    const [version, signature] = part.split(',');
    const actual = Buffer.from(signature || '', 'base64');
    return version === 'v1' && actual.length === expected.length && timingSafeEqual(actual, expected);
  });
  if (!valid) throw new Error('Invalid email webhook signature');
  return id;
}
