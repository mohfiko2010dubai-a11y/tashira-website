import { createHash } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { AVAILABILITY, WORK_STATES, requireFollowUp } from '../../../contracts/work-queue';
import { measureWorkTime } from '../../../contracts/work-time';
import type { TrpcContext } from '../../context';
import { isOperationsFlagEnabled } from '../feature-flags/feature-flags';
import { MysqlOperationsAccessProvider } from './mysql-access-provider';
import { MysqlControlledWriteExecutor } from './mysql-controlled-write-executor';

const retry = z.string().uuid();
export const workCommand = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('AVAILABILITY'), availability: z.enum(AVAILABILITY), key: retry }).strict(),
  z.object({ kind: z.literal('CLAIM'), includeTest: z.boolean(), key: retry }).strict(),
  z.object({ kind: z.literal('WORK_STATE'), applicationId: z.number().int().positive(), version: z.number().int().nonnegative(),
    state: z.enum(WORK_STATES), reason: z.string().trim().min(3).max(500), followUpAt: z.string().datetime().nullable(), key: retry }).strict(),
]);
type Command = z.infer<typeof workCommand>;
const resultSchema = z.object({ applicationId: z.number().nullable(), reference: z.string().nullable() });
type Result = z.infer<typeof resultSchema>;
type CaseRow = RowDataPacket & { id: number; reference: string; visaType: string; processingType: string;
  state: typeof WORK_STATES[number]; version: number; reason: string; dueAt: string | null; changedAt: string;
  ownerId: number | null; teamId: number | null; status: string };

function fail(message: string, code: 'FORBIDDEN' | 'CONFLICT' | 'PRECONDITION_FAILED' = 'PRECONDITION_FAILED'): never {
  throw new TRPCError({ code, message });
}

/** Queue participation never grants ALL/TEAM access to customer case payloads. */
export class MysqlWorkQueue {
  private readonly pool: Pool;
  private readonly access: MysqlOperationsAccessProvider;
  private readonly writes: MysqlControlledWriteExecutor;
  constructor(pool: Pool, access: MysqlOperationsAccessProvider, writes: MysqlControlledWriteExecutor) {
    this.pool = pool; this.access = access; this.writes = writes;
  }

  private async actor(ctx: TrpcContext) {
    if (!ctx.staffId) fail('Sign in with your named staff account to use the work queue.', 'FORBIDDEN');
    const [accounts] = await this.pool.execute<RowDataPacket[]>('SELECT is_active,staff_role AS role FROM staff_users WHERE id=?', [ctx.staffId]);
    if (accounts[0]?.is_active !== 'active') fail('Your account is inactive. Contact the administrator.', 'FORBIDDEN');
    // Rebuild administrator context from the stored role, never a command field.
    const trustedContext = { ...ctx, isAdmin: accounts[0].role === 'admin', user: undefined };
    const actor = await this.access.actorForContext(trustedContext);
    if (!actor.permissions.has('case.read_assigned') || !actor.permissions.has('case.transition')) fail('Your role cannot receive work. Ask your manager to review your role.', 'FORBIDDEN');
    const flags = await this.access.featureFlags();
    if (!isOperationsFlagEnabled('OPERATIONS_CONTROLLED_WRITES', await this.access.flagContextForContext(trustedContext), flags)) {
      fail('The work queue is not enabled here. Contact your manager.', 'FORBIDDEN');
    }
    return { actor, staffId: ctx.staffId };
  }

  private scope(teamIds: ReadonlySet<number>, all: boolean) {
    return all ? { sql: '1=1', values: [] } : {
      sql: `(c.team_id IS NULL${teamIds.size ? ` OR c.team_id IN (${[...teamIds].map(() => '?').join(',')})` : ''})`, values: [...teamIds],
    };
  }

  async overview(ctx: TrpcContext, includeTest: boolean) {
    const { actor, staffId } = await this.actor(ctx);
    const scope = this.scope(actor.teamIds, actor.scopes.includes('ALL'));
    const [counts] = await this.pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM applications a
      LEFT JOIN operations_case_controls c ON c.application_id=a.id
      WHERE c.assigned_staff_user_id IS NULL AND a.payment_status='paid'
      AND a.status IN ('submitted','payment_received','documents_pending','documents_received','under_review')
      AND (? OR (a.is_test=0 AND a.data_classification='LIVE')) AND ${scope.sql}`, [includeTest, ...scope.values]);
    const [availability] = await this.pool.execute<RowDataPacket[]>('SELECT availability FROM operations_staff_availability WHERE staff_user_id=?', [staffId]);
    // Queue preview only. Contact information, documents and finance remain
    // assigned-only; opening a preview never assigns the case.
    const [available] = await this.pool.execute<RowDataPacket[]>(`SELECT a.reference_number AS reference,
      a.visa_type AS visaType,a.processing_type AS processingType,
      DATE_FORMAT(a.created_at,'%Y-%m-%dT%H:%i:%s.000Z') AS createdAt
      FROM applications a LEFT JOIN operations_case_controls c ON c.application_id=a.id
      WHERE c.assigned_staff_user_id IS NULL AND a.payment_status='paid'
      AND a.status IN ('submitted','payment_received','documents_pending','documents_received','under_review')
      AND (? OR (a.is_test=0 AND a.data_classification='LIVE')) AND ${scope.sql}
      ORDER BY (a.processing_type='express') DESC,a.created_at,a.id LIMIT 100`, [includeTest, ...scope.values]);
    const [mine] = await this.pool.execute<CaseRow[]>(`SELECT a.id,a.reference_number AS reference,a.visa_type AS visaType,a.processing_type AS processingType,
      c.assigned_staff_user_id AS ownerId,c.team_id AS teamId,a.status,
      CASE WHEN a.status IN ('completed','cancelled','rejected') THEN 'DONE'
        ELSE COALESCE(w.work_state,CASE WHEN a.status='visa_processing' THEN 'WAIT_AUTHORITY' WHEN a.status='documents_pending' THEN 'WAIT_CUSTOMER' ELSE 'READY' END) END AS state,
      COALESCE(w.version,0) AS version,COALESCE(w.reason,'') AS reason,
      DATE_FORMAT(w.follow_up_at,'%Y-%m-%dT%H:%i:%s.000Z') AS dueAt,
      DATE_FORMAT(COALESCE(w.changed_at,c.updated_at),'%Y-%m-%dT%H:%i:%s.000Z') AS changedAt
      FROM applications a JOIN operations_case_controls c ON c.application_id=a.id
      LEFT JOIN operations_case_work w ON w.application_id=a.id
      WHERE c.assigned_staff_user_id=? AND (? OR (a.is_test=0 AND a.data_classification='LIVE'))
      ORDER BY w.follow_up_at IS NULL,w.follow_up_at,a.created_at,a.id LIMIT 500`, [staffId, includeTest]);
    return { asOf: Date.now(), availableCount: Number(counts[0]?.count ?? 0), availability: z.enum(AVAILABILITY).parse(availability[0]?.availability ?? 'OFF_DUTY'),
      available: available.map(row => ({ reference: String(row.reference), visaType: String(row.visaType), processingType: String(row.processingType), createdAt: String(row.createdAt) })),
      mine: mine.map(row => ({ applicationId: Number(row.id), reference: row.reference, visaType: row.visaType,
        processingType: row.processingType, state: z.enum(WORK_STATES).parse(row.state), version: Number(row.version),
        reason: row.reason, dueAt: row.dueAt, changedAt: row.changedAt })) };
  }

  async command(ctx: TrpcContext, input: Command): Promise<Result> {
    const identity = await this.actor(ctx);
    const staffId = identity.staffId;
    let actor = identity.actor;
    const connection = await this.pool.getConnection();
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    try {
      await connection.beginTransaction();
      // Serialize selection and staff switches. Existing case mutations still use
      // application -> case-control lock order and version checks.
      await connection.query('SELECT id FROM operations_work_dispatch_lock WHERE id=1 FOR UPDATE');
      const [replays] = await connection.execute<RowDataPacket[]>('SELECT command_hash,result_json FROM operations_work_events WHERE staff_user_id=? AND idempotency_key=?', [staffId, input.key]);
      if (replays[0]) {
        if (replays[0].command_hash !== hash) fail('This action changed during retry. Refresh and try again.', 'CONFLICT');
        const result = resultSchema.parse(typeof replays[0].result_json === 'string' ? JSON.parse(replays[0].result_json) : replays[0].result_json);
        await connection.commit();
        return result;
      }
      // Recheck deactivation after waiting for another dispatcher transaction.
      const [active] = await connection.execute<RowDataPacket[]>('SELECT is_active,staff_role FROM staff_users WHERE id=?', [staffId]);
      if (active[0]?.is_active !== 'active') fail('Your account is inactive. Contact the administrator.', 'FORBIDDEN');
      const access = new MysqlOperationsAccessProvider({ query: async (sql, parameters = []) => {
        const [records] = await connection.execute<RowDataPacket[]>(sql, [...parameters]);
        return records;
      } });
      const trustedContext = { ...ctx, isAdmin: active[0].staff_role === 'admin', user: undefined };
      actor = await access.actorForContext(trustedContext);
      if (!actor.permissions.has('case.read_assigned') || !actor.permissions.has('case.transition')) fail('Your role changed. Contact your manager.', 'FORBIDDEN');
      const flags = await access.featureFlags();
      if (!isOperationsFlagEnabled('OPERATIONS_CONTROLLED_WRITES', await access.flagContextForContext(trustedContext), flags)) fail('The work queue is disabled. Contact your manager.', 'FORBIDDEN');
      let result: Result = { applicationId: null, reference: null };
      let previous: string | null = null;
      let next: string;
      let reason: string;
      let due: string | null = null;
      if (input.kind === 'AVAILABILITY') {
        const [current] = await connection.execute<RowDataPacket[]>('SELECT availability FROM operations_staff_availability WHERE staff_user_id=?', [staffId]);
        previous = String(current[0]?.availability ?? 'OFF_DUTY');
        next = input.availability;
        reason = 'Employee declared availability';
        await connection.execute(`INSERT INTO operations_staff_availability (staff_user_id,availability) VALUES (?,?)
          ON DUPLICATE KEY UPDATE availability=VALUES(availability),changed_at=UTC_TIMESTAMP(3)`, [staffId, input.availability]);
      } else if (input.kind === 'CLAIM') {
        const [availability] = await connection.execute<RowDataPacket[]>('SELECT availability FROM operations_staff_availability WHERE staff_user_id=?', [staffId]);
        if (availability[0]?.availability !== 'AVAILABLE') fail('Set your availability to Available before receiving a case.');
        const scope = this.scope(actor.teamIds, actor.scopes.includes('ALL'));
        // Resume actionable older work before taking a fresh case. Keep external
        // waits assigned; a customer message alone never changes this state.
        const [cases] = await connection.execute<CaseRow[]>(`SELECT a.id,a.reference_number AS reference,c.assigned_staff_user_id AS ownerId FROM applications a
          LEFT JOIN operations_case_controls c ON c.application_id=a.id
          LEFT JOIN operations_case_work w ON w.application_id=a.id
          WHERE a.payment_status='paid' AND a.status NOT IN ('completed','rejected','cancelled')
          AND ((c.assigned_staff_user_id IS NULL AND a.status IN ('submitted','payment_received','documents_pending','documents_received','under_review'))
            OR (c.assigned_staff_user_id=? AND (w.work_state IN ('ACTIVE','READY') OR w.follow_up_at<=UTC_TIMESTAMP(3)
              OR (w.application_id IS NULL AND a.status NOT IN ('visa_processing','documents_pending')))))
          AND (? OR (a.is_test=0 AND a.data_classification='LIVE')) AND (c.assigned_staff_user_id=? OR ${scope.sql})
          ORDER BY (c.assigned_staff_user_id=? AND w.work_state='ACTIVE') DESC,
            (w.follow_up_at<=UTC_TIMESTAMP(3)) DESC,(a.processing_type='express') DESC,
            COALESCE(w.follow_up_at,a.created_at),a.id LIMIT 1 FOR UPDATE`, [staffId, input.includeTest, staffId, ...scope.values, staffId]);
        const selected = cases[0];
        next = selected ? 'ACTIVE' : 'EMPTY';
        reason = selected ? 'Next available case by priority then age' : 'No eligible work available';
        if (selected) {
          result = { applicationId: Number(selected.id), reference: selected.reference };
          if (selected.ownerId !== null) {
            const [state] = await connection.execute<RowDataPacket[]>('SELECT work_state FROM operations_case_work WHERE application_id=?', [selected.id]);
            previous = String(state[0]?.work_state ?? 'READY');
            reason = 'Resume assigned work';
            await connection.execute(`INSERT INTO operations_case_work (application_id,work_state,reason) VALUES (?,'ACTIVE',?)
              ON DUPLICATE KEY UPDATE work_state='ACTIVE',version=version+1,follow_up_at=NULL,reason=VALUES(reason),changed_at=UTC_TIMESTAMP(3)`, [selected.id, reason]);
          } else {
          // Respect configured workload limits; absent limits do not invent a cap.
          const [limits] = await connection.execute<RowDataPacket[]>(`SELECT wl.workload_limit AS maximum,
            (SELECT COUNT(*) FROM operations_case_controls c JOIN applications a ON a.id=c.application_id
              WHERE c.assigned_staff_user_id=? AND a.status NOT IN ('completed','rejected','cancelled')) AS workload
            FROM operations_staff_workload_limits wl WHERE wl.staff_user_id=?`, [staffId, staffId]);
          if (limits[0] && Number(limits[0].workload) >= Number(limits[0].maximum)) fail('Your configured workload limit is reached. Ask your manager to review your workload.');
          await this.writes.claimQueuedCase(connection, Number(selected.id), staffId, actor, input.key, flags);
          await connection.execute(`INSERT INTO operations_case_work (application_id,work_state,reason) VALUES (?,'ACTIVE',?)
            ON DUPLICATE KEY UPDATE work_state='ACTIVE',version=version+1,reason=VALUES(reason),follow_up_at=NULL,changed_at=UTC_TIMESTAMP(3)`, [selected.id, reason]);
          }
        }
      } else {
        const [cases] = await connection.execute<CaseRow[]>(`SELECT a.id,a.reference_number AS reference,a.status FROM applications a WHERE a.id=? FOR UPDATE`, [input.applicationId]);
        const [controls] = await connection.execute<RowDataPacket[]>('SELECT assigned_staff_user_id FROM operations_case_controls WHERE application_id=? FOR UPDATE', [input.applicationId]);
        if (!cases[0] || Number(controls[0]?.assigned_staff_user_id) !== staffId) fail('This case is no longer assigned to you. Refresh your queue.', 'FORBIDDEN');
        if (['completed','rejected','cancelled'].includes(cases[0].status)) fail('This application is closed. Open its history instead.');
        if (input.state === 'DONE') fail('لا يمكن إغلاق الطلب من تحديث المتابعة. أكمل إجراء التسليم أو الإغلاق المعتمد داخل ملف الطلب أولًا.');
        if (!requireFollowUp(input.state, input.followUpAt, Date.now())) fail('Choose a future follow-up date for this waiting case.');
        const [states] = await connection.execute<RowDataPacket[]>('SELECT version,work_state FROM operations_case_work WHERE application_id=? FOR UPDATE', [input.applicationId]);
        if (Number(states[0]?.version ?? 0) !== input.version) fail('The work state changed. Refresh before saving again.', 'CONFLICT');
        previous = String(states[0]?.work_state ?? 'READY');
        next = input.state;
        reason = input.reason;
        due = input.state.startsWith('WAIT_') ? input.followUpAt : null;
        await connection.execute(`INSERT INTO operations_case_work (application_id,work_state,version,reason,follow_up_at) VALUES (?,?,1,?,?)
          ON DUPLICATE KEY UPDATE work_state=VALUES(work_state),version=version+1,reason=VALUES(reason),follow_up_at=VALUES(follow_up_at),changed_at=UTC_TIMESTAMP(3)`,
        [input.applicationId, input.state, reason, due ? new Date(due) : null]);
        result = { applicationId: input.applicationId, reference: cases[0].reference };
      }
      if (next === 'ACTIVE' && result.applicationId) await this.pauseOtherWork(connection, staffId, result.applicationId, input.key);
      await this.event(connection, staffId, input, hash, previous, next, reason, due, result);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }

  private async pauseOtherWork(connection: PoolConnection, staffId: number, applicationId: number, key: string) {
    const [others] = await connection.execute<RowDataPacket[]>(`SELECT w.application_id FROM operations_case_work w
      JOIN operations_case_controls c ON c.application_id=w.application_id
      WHERE c.assigned_staff_user_id=? AND w.work_state='ACTIVE' AND w.application_id<>?`, [staffId, applicationId]);
    for (const other of others) {
      const id = Number(other.application_id);
      await connection.execute("UPDATE operations_case_work SET work_state='READY',version=version+1,reason='Switched to another case',changed_at=UTC_TIMESTAMP(3) WHERE application_id=?", [id]);
      await connection.execute(`INSERT INTO operations_work_events
        (staff_user_id,application_id,event_type,previous_state,next_state,reason,idempotency_key,command_hash,result_json)
        VALUES (?,?,'WORK_STATE','ACTIVE','READY','Switched to another case',?,?,?)`,
      [staffId, id, `${key}:pause:${id}`, createHash('sha256').update(`${key}:${id}`).digest('hex'), JSON.stringify({ applicationId: id, reference: null })]);
    }
  }

  private async event(connection: PoolConnection, staffId: number, input: Command, hash: string, previous: string | null,
    next: string, reason: string, due: string | null, result: Result) {
    await connection.execute(`INSERT INTO operations_work_events
      (staff_user_id,application_id,event_type,previous_state,next_state,reason,follow_up_at,idempotency_key,command_hash,result_json)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, [staffId, result.applicationId, input.kind, previous, next, reason, due ? new Date(due) : null, input.key, hash, JSON.stringify(result)]);
  }

  async managerReport(ctx: TrpcContext) {
    const { actor } = await this.actor(ctx);
    if (!actor.scopes.includes('ALL') || !actor.permissions.has('case.assign')) fail('Only the manager can open employee reports.', 'FORBIDDEN');
    const now = Date.now();
    const day = new Date(now + 4 * 3600000).toISOString().slice(0,10);
    const start = Date.parse(`${day}T00:00:00+04:00`);
    const [events] = await this.pool.execute<RowDataPacket[]>(`SELECT e.staff_user_id AS staffId,s.name,
      e.application_id AS applicationId,e.next_state AS nextState,
      UNIX_TIMESTAMP(e.created_at)*1000 AS at FROM operations_work_events e JOIN staff_users s ON s.id=e.staff_user_id
      WHERE e.created_at<=UTC_TIMESTAMP(3) ORDER BY e.created_at,e.id LIMIT 10001`);
    if (events.length > 10000) fail('This report needs an archived-time summary. Contact support before using the totals.');
    const [claims] = await this.pool.execute<RowDataPacket[]>(`SELECT actor_reference AS actor,COUNT(DISTINCT application_id) AS count
      FROM operations_action_events WHERE action_type='CLAIM' AND created_at>=? GROUP BY actor_reference`, [new Date(start)]);
    // Assignment changes close the previous employee's interval; they must never
    // make the new owner's work appear as effort by the previous employee.
    const [handoffs] = await this.pool.execute<RowDataPacket[]>(`SELECT previous_assignee_reference AS previous,application_id AS applicationId,
      UNIX_TIMESTAMP(created_at)*1000 AS at FROM operations_action_events
      WHERE action_type='REASSIGN' AND previous_assignee_reference IS NOT NULL ORDER BY created_at,id LIMIT 10001`);
    if (handoffs.length > 10000) fail('This report needs an archived-time summary. Contact support before using the totals.');
    const ids = [...new Set(events.map(row => Number(row.staffId)))];
    return { day, asOf: now, staff: ids.map(id => ({ staffId: id, name: String(events.find(row => Number(row.staffId) === id)?.name ?? ''),
      claimedToday: Number(claims.find(row => row.actor === `staff:${id}`)?.count ?? 0),
      ...measureWorkTime([
        ...events.filter(row => Number(row.staffId) === id).map(row => ({ at: Number(row.at), applicationId: row.applicationId === null ? null : Number(row.applicationId), next: String(row.nextState) })),
        ...handoffs.filter(row => row.previous === `staff:${id}`).map(row => ({ at: Number(row.at), applicationId: Number(row.applicationId), next: 'TRANSFERRED' })),
      ], start, now),
    })) };
  }
}
