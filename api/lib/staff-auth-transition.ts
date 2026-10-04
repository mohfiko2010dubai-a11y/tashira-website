import type { RowDataPacket } from 'mysql2/promise';
import { defaultOperationsPool } from './operations/mysql-query-client';

export async function legacyAdminLoginEnabled(): Promise<boolean> {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>('SELECT legacy_enabled FROM staff_auth_transition WHERE singleton=1');
  return rows[0]?.legacy_enabled === 1;
}
export async function recordNamedAdminVerification(staffId: number, role: string): Promise<void> {
  if (role !== 'admin') return;
  await defaultOperationsPool().execute(
    'UPDATE staff_auth_transition SET named_admin_verified_at=COALESCE(named_admin_verified_at,UTC_TIMESTAMP()) WHERE singleton=1 AND owner_staff_id=?', [staffId]);
}
