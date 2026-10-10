import crypto from 'node:crypto';
import { z } from 'zod';
import { renderTransactionalEmail } from './transactional-email';
import { depositEmailEncryptionKey, depositEmailConfigurationHash } from './email-provider';

const envelopeSchema = z.object({ recipient: z.string().email(), variables: z.record(z.string(), z.string()), deliveryFingerprint: z.string() });
export type DepositEmailEnvelope = z.infer<typeof envelopeSchema>;

export function depositDeliveryFingerprint(variables: Record<string, string>) {
  return crypto.createHash('sha256').update(JSON.stringify({
    rendered: renderTransactionalEmail('SECURITY_DEPOSIT_REQUEST', variables),
    configuration: depositEmailConfigurationHash(),
  })).digest('hex');
}

// Bound to its request: copying encrypted data to another row cannot expose a usable link.
export function sealDepositEmail(requestId: string, envelope: DepositEmailEnvelope) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', depositEmailEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(requestId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(envelopeSchema.parse(envelope)), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(value => value.toString('base64url')).join('.');
}

export function openDepositEmail(requestId: string, stored: string): DepositEmailEnvelope {
  const parts = stored.split('.');
  if (parts.length !== 3) throw new Error('Invalid deposit email envelope');
  const [iv, tag, ciphertext] = parts.map(value => Buffer.from(value, 'base64url'));
  const cipher = crypto.createDecipheriv('aes-256-gcm', depositEmailEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(requestId)); cipher.setAuthTag(tag);
  return envelopeSchema.parse(JSON.parse(Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString('utf8')));
}
