export function minimumPassportExpiry(arrivalDate?: string | null, now = new Date()): string {
  const today = now.toISOString().slice(0, 10);
  const base = arrivalDate && /^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) && arrivalDate > today ? arrivalDate : today;
  const [year, month, day] = base.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + 6, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
export function validPassportExpiry(expiry: string, arrivalDate?: string | null, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return false;
  const parsed = new Date(`${expiry}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === expiry && expiry >= minimumPassportExpiry(arrivalDate, now);
}

/** Latin passport names allow spaces and common name punctuation, not other scripts. */
export function validPassportName(name: string): boolean {
  return /\p{Script=Latin}/u.test(name) && /^[\p{Script=Latin}\p{M} .'’-]+$/u.test(name.trim());
}
