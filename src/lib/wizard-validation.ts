import { z } from 'zod';

export function validStartContact(email: string, phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return z.email().safeParse(email.trim()).success
    && /^\+?[\d\s().-]+$/.test(phone.trim())
    && digits.length >= 7 && digits.length <= 15;
}
