import * as cookie from 'cookie';

export const STAFF_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const staffSessions = new Map<string, { staffId: number; expiresAt: number; lastActivity: number }>();

function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of staffSessions.entries()) {
    if (session.expiresAt <= now || session.lastActivity + STAFF_IDLE_TIMEOUT_MS <= now) staffSessions.delete(token);
  }
}

export function createStaffSession(staffId: number): string {
  cleanExpiredSessions();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  staffSessions.set(token, { staffId, expiresAt: Date.now() + 8 * 60 * 60 * 1000, lastActivity: Date.now() });
  return token;
}

export function getStaffSession(token: string, active = false): { staffId: number } | null {
  cleanExpiredSessions();
  const session = staffSessions.get(token);
  if (!session || session.expiresAt < Date.now()) return null;
  if (active) session.lastActivity = Date.now();
  return { staffId: session.staffId };
}

export function deleteStaffSession(token: string): void {
  staffSessions.delete(token);
}

export function revokeStaffSessions(staffId: number): void {
  for (const [token, session] of staffSessions) if (session.staffId === staffId) staffSessions.delete(token);
}
export function staffTokenFromHeaders(headers: Headers): string {
  return cookie.parse(headers.get('cookie') || '').tashira_staff_session || headers.get('x-staff-token') || '';
}
export function staffSessionCookie(headers: Headers, token: string): string {
  const host = headers.get('host') || '';
  return cookie.serialize('tashira_staff_session', token, { httpOnly: true, sameSite: 'lax', path: '/',
    secure: !host.startsWith('localhost:') && !host.startsWith('127.0.0.1:'), maxAge: token ? 8 * 60 * 60 : 0 });
}
