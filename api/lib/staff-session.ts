const staffSessions = new Map<string, { staffId: number; expiresAt: number }>();

function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of staffSessions.entries()) {
    if (session.expiresAt < now) staffSessions.delete(token);
  }
}

export function createStaffSession(staffId: number): string {
  cleanExpiredSessions();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  staffSessions.set(token, { staffId, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  return token;
}

export function getStaffSession(token: string): { staffId: number } | null {
  cleanExpiredSessions();
  const session = staffSessions.get(token);
  if (!session || session.expiresAt < Date.now()) return null;
  return { staffId: session.staffId };
}

export function deleteStaffSession(token: string): void {
  staffSessions.delete(token);
}
