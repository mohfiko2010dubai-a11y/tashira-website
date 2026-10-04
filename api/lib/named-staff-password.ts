import { eq } from 'drizzle-orm';
import { staffUsers } from '@db/schema';
import { getDb } from '../queries/connection';
import { verifyPassword } from './password';

export async function verifyNamedStaffPassword(staffId: number | undefined, password: string): Promise<boolean> {
  if (!staffId) return false;
  const [staff] = await getDb().select().from(staffUsers).where(eq(staffUsers.id, staffId)).limit(1);
  return Boolean(staff?.isActive === 'active' && (await verifyPassword(password, staff.passwordHash)).valid);
}
