import { z } from 'zod';

export function validStartEmail(email: string): boolean {
  return z.email().safeParse(email.trim()).success;
}

export function validStartPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return /^\+?[\d\s().-]+$/.test(phone.trim())
    && digits.length >= 7 && digits.length <= 15;
}

export function validStartContact(email: string, phone: string): boolean {
  return validStartEmail(email) && validStartPhone(phone);
}
