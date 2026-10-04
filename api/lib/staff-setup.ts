import { createHash } from 'node:crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { TRPCError } from '@trpc/server';
import { defaultOperationsPool } from './operations/mysql-query-client';
import { hashPassword } from './password';
import { validateNewAdminPassword } from './admin-session';

export const STAFF_SETUP_REQUIRED = '!SETUP_REQUIRED!';
export function staffSetupTokenHash(token: string): string {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This setup link is invalid. Ask the administrator for a new link.' });
  return createHash('sha256').update(token).digest('hex');
}

/** Password chosen by the account owner; invitation possession never grants a session. */
export async function completeStaffSetup(token: string, password: string) {
  const tokenHash = staffSetupTokenHash(token);
  const policyError = validateNewAdminPassword(password);
  if (policyError) throw new TRPCError({ code: 'BAD_REQUEST', message: policyError });
  const connection = await defaultOperationsPool().getConnection();
  try {
    await connection.beginTransaction();
    const [links] = await connection.execute<RowDataPacket[]>(
      'SELECT staff_id FROM staff_setup_links WHERE token_hash=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE', [tokenHash]);
    const invalid = () => new TRPCError({ code: 'BAD_REQUEST', message: 'This setup link has expired or was already used. Ask the administrator for a new link.' });
    if (!links[0]) throw invalid();
    const [accounts] = await connection.execute<RowDataPacket[]>('SELECT username,password_hash,is_active FROM staff_users WHERE id=? FOR UPDATE', [links[0].staff_id]);
    const account = accounts[0];
    if (!account || account.password_hash !== STAFF_SETUP_REQUIRED || account.is_active !== 'inactive') throw invalid();
    const [updated] = await connection.execute<ResultSetHeader>(
      "UPDATE staff_users SET password_hash=?,is_active='active' WHERE id=? AND password_hash=? AND is_active='inactive'", [await hashPassword(password), links[0].staff_id, STAFF_SETUP_REQUIRED]);
    if (updated.affectedRows !== 1) throw invalid();
    await connection.execute('UPDATE staff_setup_links SET consumed_at=UTC_TIMESTAMP() WHERE staff_id=? AND consumed_at IS NULL', [links[0].staff_id]);
    await connection.commit();
    return { username: String(account.username) };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
