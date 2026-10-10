import { randomUUID } from 'node:crypto';
import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { TrpcContext } from './context';
import { MysqlWorkQueue } from './lib/operations/mysql-work-queue';
import { MysqlOperationsAccessProvider } from './lib/operations/mysql-access-provider';
import { MysqlControlledWriteExecutor } from './lib/operations/mysql-controlled-write-executor';
import { MysqlOperationsSqlClient } from './lib/operations/mysql-query-client';
import { syncCaseWorkStatus } from './lib/operations/case-work-status';

const url = process.env.OPS_EXECUTOR_DATABASE_URL;
const suite = url ? describe.sequential : describe.skip;
suite('atomic staff work dispatch', () => {
  let pool: Pool;
  let queue: MysqlWorkQueue;
  let access: MysqlOperationsAccessProvider;
  let writes: MysqlControlledWriteExecutor;
  const staff: number[] = [];
  const cases: number[] = [];
  const tag = randomUUID().slice(0, 8);
  const context = (id: number): TrpcContext => ({ staffId: id, isAdmin: false, req: new Request('https://example.invalid'), resHeaders: new Headers(), customerApplicationReferences: new Set() });
  const key = () => randomUUID();
  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost','127.0.0.1'].includes(target.hostname) || !target.pathname.startsWith('/tashira_ops_rehearsal_')) throw new Error('Synthetic rehearsal database required');
    pool = createPool({ uri: url, connectionLimit: 8 });
    access = new MysqlOperationsAccessProvider(new MysqlOperationsSqlClient(pool));
    writes = new MysqlControlledWriteExecutor(pool, access);
    queue = new MysqlWorkQueue(pool, access, writes);
    const [role] = await pool.execute<ResultSetHeader>("INSERT INTO operations_roles (code,name) VALUES (?,?)", [`Q_${tag}`, `Queue ${tag}`]);
    for (const code of ['case.read_assigned','case.transition']) {
      await pool.execute('INSERT INTO operations_role_permissions (role_id,permission_id,granted_by) SELECT ?,id,\'synthetic\' FROM operations_permissions WHERE code=?', [role.insertId, code]);
    }
    for (let i = 0; i < 3; i++) {
      const [inserted] = await pool.execute<ResultSetHeader>("INSERT INTO staff_users (username,password_hash,name,is_active,staff_role) VALUES (?,'synthetic-unusable',?,'active',?)", [`q-${tag}-${i}`, `Synthetic queue ${i}`, i === 2 ? 'admin' : 'staff']);
      staff.push(inserted.insertId);
      await pool.execute("INSERT INTO operations_staff_roles (staff_user_id,role_id,granted_by,valid_from) VALUES (?,?,'synthetic',UTC_TIMESTAMP())", [inserted.insertId, role.insertId]);
      await pool.execute("INSERT INTO operations_scope_grants (staff_user_id,scope_type,granted_by) VALUES (?,'ASSIGNED','synthetic')", [inserted.insertId]);
    }
    await pool.execute(`INSERT INTO operations_feature_flags (flag_key,environment,enabled,scope_type,scope_reference,reason,changed_by)
      VALUES ('OPERATIONS_CONTROLLED_WRITES','TEST','YES','GLOBAL','','Synthetic queue','synthetic') ON DUPLICATE KEY UPDATE enabled='YES'`);
    // Earliest synthetic dates isolate selection from the other integration fixtures.
    for (const [index, speed, date] of [[0,'regular','2000-01-01'],[1,'express','2001-01-01'],[2,'express','2002-01-01']] as const) {
      const [inserted] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
        (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status,data_classification,is_test,created_at)
        VALUES (?,'single','non-gcc','ROUTE_TEST',?,'queue@example.invalid','000',1,100,'documents_received','paid','TEST',1,?)`, [`QUEUE-${tag}-${index}`, speed, date]);
      cases.push(inserted.insertId);
    }
  });
  afterAll(async () => { await pool?.end(); });

  it('requires explicit availability, never infers it from login', async () => {
    await expect(queue.overview({ ...context(staff[0]), staffId: undefined }, true)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(queue.managerReport(context(staff[0]))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(queue.command(context(staff[0]), { kind: 'CLAIM', includeTest: true, key: key() })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect((await queue.overview(context(staff[0]), true)).availability).toBe('OFF_DUTY');
  });
  it('simultaneous claims select distinct cases in priority/age order and replay safely', async () => {
    for (const id of staff.slice(0,2)) await queue.command(context(id), { kind: 'AVAILABILITY', availability: 'AVAILABLE', key: key() });
    const commands = staff.slice(0,2).map(() => ({ kind: 'CLAIM' as const, includeTest: true, key: key() }));
    const result = await Promise.all(staff.slice(0,2).map((id,i) => queue.command(context(id), commands[i])));
    expect(new Set(result.map(item => item.applicationId))).toEqual(new Set([cases[1],cases[2]]));
    expect(await queue.command(context(staff[0]), commands[0])).toEqual(result[0]);
    const [audit] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM operations_action_events WHERE application_id IN (?,?) AND action_type=\'CLAIM\'', [cases[1],cases[2]]);
    expect(Number(audit[0].n)).toBe(2);
    const mine = await queue.overview(context(staff[0]), true);
    expect(mine.mine.map(row => row.applicationId)).toEqual([result[0].applicationId]);
    expect(mine.available.every(row => row.reference !== result[0].reference && row.reference !== result[1].reference)).toBe(true);
    for (const row of mine.available) expect(Object.keys(row).sort()).toEqual(['createdAt', 'processingType', 'reference', 'visaType']);
    expect(JSON.stringify(mine)).not.toMatch(/queue@example|total_amount|supplier_cost|password/);
  });
  it('denies another employee work changes and requires reason/date/version; waiting does not change visa/payment', async () => {
    const own = (await queue.overview(context(staff[0]), true)).mine[0];
    const input = { kind: 'WORK_STATE' as const, applicationId: own.applicationId, version: own.version, state: 'WAIT_CUSTOMER' as const, reason: 'Waiting for replacement document', followUpAt: '2040-01-01T00:00:00.000Z', key: key() };
      await expect(queue.command(context(staff[1]), input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(queue.command(context(staff[0]), { ...input, state: 'DONE', key: key() })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    await expect(queue.command(context(staff[0]), { ...input, followUpAt: null })).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    await queue.command(context(staff[0]), input);
    await expect(queue.command(context(staff[0]), { ...input, key: key() })).rejects.toMatchObject({ code: 'CONFLICT' });
    const [saved] = await pool.execute<RowDataPacket[]>('SELECT status,payment_status FROM applications WHERE id=?', [own.applicationId]);
    expect(saved[0]).toMatchObject({ status: 'documents_received', payment_status: 'paid' });
    expect((await queue.overview(context(staff[0]), true)).mine[0].state).toBe('WAIT_CUSTOMER');
  });
  it('manager reassigns common work to an eligible named employee without a team or workload setting', async () => {
    const own = (await queue.overview(context(staff[0]), true)).mine[0];
    const manager = await access.actorForContext({ ...context(staff[2]), isAdmin: true });
    const capabilities = await writes.capabilities(own.applicationId, manager);
    expect(capabilities.permittedAssignees).toEqual(expect.arrayContaining([expect.objectContaining({ actorId: `staff:${staff[1]}` })]));
    const command = { applicationId: own.applicationId, expectedVersion: capabilities.version, idempotencyKey: key(), reason: 'Synthetic manager coverage', mode: 'REASSIGN' as const, assigneeId: `staff:${staff[1]}` };
    await writes.assignment(command, manager);
    const [events] = await pool.execute<RowDataPacket[]>("SELECT actor_reference FROM operations_action_events WHERE application_id=? AND action_type='REASSIGN'", [own.applicationId]);
    expect(events[0].actor_reference).toBe(`staff:${staff[2]}`);
    expect((await queue.overview(context(staff[0]), true)).mine).toHaveLength(0);
    expect((await queue.overview(context(staff[1]), true)).mine.map(item => item.applicationId)).toContain(own.applicationId);
    const [saved] = await pool.execute<RowDataPacket[]>('SELECT team_id,assigned_staff_user_id FROM operations_case_controls WHERE application_id=?', [own.applicationId]);
    expect(saved[0]).toMatchObject({ team_id: null, assigned_staff_user_id: staff[1] });
    await expect(writes.assignment({ ...command, idempotencyKey: key(), expectedVersion: capabilities.version + 1, assigneeId: `staff:${staff[0]}` }, await access.actorForContext(context(staff[1])))).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
  });

  it('controlled status changes move one owned case between lists and replay without duplicate closure', async () => {
    const own = (await queue.overview(context(staff[1]), true)).mine.find(row => row.state === 'WAIT_CUSTOMER')!;
    const actor = await access.actorForContext(context(staff[1]));
    const transition = async (to: 'documents_pending' | 'documents_received' | 'cancelled') => {
      const capabilities = await writes.capabilities(own.applicationId, actor);
      const command = { applicationId: own.applicationId, expectedVersion: capabilities.version, idempotencyKey: key(), reason: 'Synthetic queue transition', to };
      const result = await writes.statusTransition(command, actor);
      expect(await writes.statusTransition(command, actor)).toEqual({ ...result, status: 'IDEMPOTENT_REPLAY' });
    };
    await transition('documents_pending');
    let item = (await queue.overview(context(staff[1]), true)).mine.find(row => row.applicationId === own.applicationId)!;
    expect(item).toMatchObject({ state: 'WAIT_CUSTOMER', dueAt: own.dueAt, version: own.version + 1 });
    await transition('documents_received');
    item = (await queue.overview(context(staff[1]), true)).mine.find(row => row.applicationId === own.applicationId)!;
    expect(item.state).toBe('READY');
    expect(item.dueAt).toBeNull();
    await expect(queue.command(context(staff[1]), { kind: 'WORK_STATE', applicationId: own.applicationId, version: own.version, state: 'ACTIVE', reason: 'Stale browser tab', followUpAt: null, key: key() })).rejects.toMatchObject({ code: 'CONFLICT' });
    await transition('cancelled');
    const overview = await queue.overview(context(staff[1]), true);
    expect(overview.mine.filter(row => row.applicationId === own.applicationId)).toHaveLength(1);
    expect(overview.mine.find(row => row.applicationId === own.applicationId)?.state).toBe('DONE');
    expect(overview.available.some(row => row.reference === own.reference)).toBe(false);
    const [events] = await pool.execute<RowDataPacket[]>("SELECT next_state FROM operations_work_events WHERE application_id=? AND idempotency_key LIKE 'status:%' ORDER BY id", [own.applicationId]);
    expect(events.map(row => row.next_state)).toEqual(['WAIT_CUSTOMER', 'READY', 'DONE']);
    expect((await queue.overview(context(staff[0]), true)).mine.some(row => row.applicationId === own.applicationId)).toBe(false);
  });

  it('rolls back status, queue version and queue history together when audit storage fails', async () => {
    const own = (await queue.overview(context(staff[1]), true)).mine.find(row => row.state !== 'DONE')!;
    const actor = await access.actorForContext(context(staff[1]));
    const capabilities = await writes.capabilities(own.applicationId, actor);
    const failure = new MysqlControlledWriteExecutor(pool, access, { beforeAuditPersist: () => { throw new Error('Synthetic audit failure'); } });
    const [before] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM operations_work_events WHERE application_id=?', [own.applicationId]);
    await expect(failure.statusTransition({ applicationId: own.applicationId, expectedVersion: capabilities.version, idempotencyKey: key(), reason: 'Synthetic rollback', to: 'cancelled' }, actor)).rejects.toThrow();
    expect((await queue.overview(context(staff[1]), true)).mine.find(row => row.applicationId === own.applicationId)).toEqual(own);
    const [saved] = await pool.execute<RowDataPacket[]>('SELECT status FROM applications WHERE id=?', [own.applicationId]);
    expect(saved[0].status).toBe('documents_received');
    const [after] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM operations_work_events WHERE application_id=?', [own.applicationId]);
    expect(after[0].n).toBe(before[0].n);
  });

  it('concurrent status saves apply one transition and one queue event', async () => {
    const own = (await queue.overview(context(staff[1]), true)).mine.find(row => row.state !== 'DONE')!;
    const actor = await access.actorForContext(context(staff[1]));
    const capabilities = await writes.capabilities(own.applicationId, actor);
    const command = { applicationId: own.applicationId, expectedVersion: capabilities.version, reason: 'Synthetic simultaneous update', to: 'documents_pending' as const };
    const results = await Promise.allSettled([writes.statusTransition({ ...command, idempotencyKey: key() }, actor), writes.statusTransition({ ...command, idempotencyKey: key() }, actor)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const [events] = await pool.execute<RowDataPacket[]>("SELECT next_state FROM operations_work_events WHERE application_id=? AND idempotency_key LIKE 'status:%'", [own.applicationId]);
    expect(events.map(row => row.next_state)).toEqual(['WAIT_CUSTOMER']);
    expect((await queue.overview(context(staff[1]), true)).mine.find(row => row.applicationId === own.applicationId)?.version).toBe(own.version + 1);
  });

  it('supports old assigned cases without work rows, reopening, no-op saves and unassigned cases without inventing ownership', async () => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      await connection.execute('SELECT id FROM applications WHERE id=? FOR UPDATE', [cases[0]]);
      await syncCaseWorkStatus(connection, cases[0], 'documents_received', 'under_review', key());
      const [unassigned] = await connection.execute<RowDataPacket[]>('SELECT * FROM operations_case_work WHERE application_id=?', [cases[0]]);
      expect(unassigned).toHaveLength(0);
      await connection.execute('INSERT INTO operations_case_controls (application_id,assigned_staff_user_id) VALUES (?,?)', [cases[0], staff[1]]);
      await syncCaseWorkStatus(connection, cases[0], 'visa_processing', 'visa_received', key());
      await syncCaseWorkStatus(connection, cases[0], 'visa_received', 'completed', key());
      await syncCaseWorkStatus(connection, cases[0], 'completed', 'completed', key());
      await syncCaseWorkStatus(connection, cases[0], 'completed', 'under_review', key());
      const [saved] = await connection.execute<RowDataPacket[]>('SELECT work_state,version,follow_up_at FROM operations_case_work WHERE application_id=?', [cases[0]]);
      expect(saved[0]).toMatchObject({ work_state: 'READY', version: 3, follow_up_at: null });
      const [events] = await connection.execute<RowDataPacket[]>('SELECT previous_state,next_state FROM operations_work_events WHERE application_id=? ORDER BY id', [cases[0]]);
      expect(events.map(row => [row.previous_state, row.next_state])).toEqual([['WAIT_AUTHORITY','READY'],['READY','DONE'],['DONE','READY']]);
    } finally { await connection.rollback(); connection.release(); }
  });

  it('named manager can participate; history is append-only and deactivation blocks actions', async () => {
    await queue.command(context(staff[2]), { kind: 'AVAILABILITY', availability: 'AVAILABLE', key: key() });
    const claimed = await queue.command(context(staff[2]), { kind: 'CLAIM', includeTest: true, key: key() });
    expect(claimed.applicationId).not.toBeNull();
    const [audit] = await pool.execute<RowDataPacket[]>('SELECT actor_reference FROM operations_action_events WHERE application_id=? AND action_type=\'CLAIM\'', [claimed.applicationId]);
    expect(audit[0].actor_reference).toBe(`staff:${staff[2]}`);
    await expect(pool.execute('DELETE FROM operations_work_events WHERE staff_user_id=?', [staff[2]])).rejects.toMatchObject({ sqlState: '45000' });
    await pool.execute("UPDATE staff_users SET is_active='inactive' WHERE id=?", [staff[2]]);
    await expect(queue.overview(context(staff[2]), true)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
