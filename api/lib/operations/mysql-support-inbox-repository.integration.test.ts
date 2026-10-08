import { randomUUID } from "node:crypto";
import { createPool, type Pool, type ResultSetHeader } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MysqlSupportInboxRepository } from "./mysql-support-inbox-repository";

const databaseUrl = process.env.OPS_SUPPORT_DATABASE_URL;
const integration = databaseUrl ? describe.sequential : describe.skip;
function id(result: object): number { const value = Reflect.get(result, "insertId"); if (typeof value !== "number" || value < 1) throw new Error("SYNTHETIC_ID_INVALID"); return value; }

integration("MySQL Support Inbox repository", () => {
  let pool: Pool; let repository: MysqlSupportInboxRepository; let staffId = 0; let threadId = ""; let messageId = "";
  const suffix = `${process.pid}-${Date.now()}`;
  beforeAll(async () => {
    pool = createPool({ uri: databaseUrl ?? "", connectionLimit: 3 }); repository = new MysqlSupportInboxRepository(pool);
    const [department] = await pool.execute<ResultSetHeader>("INSERT INTO operations_departments (code,name) VALUES (?,?)", [`SUPPORT-${suffix}`,"Synthetic Support"]); const departmentId = id(department);
    const [team] = await pool.execute<ResultSetHeader>("INSERT INTO operations_teams (department_id,code,name) VALUES (?,?,?)", [departmentId,`SUPPORT-${suffix}`,"Synthetic Support Team"]); const teamId = id(team);
    const [staff] = await pool.execute<ResultSetHeader>("INSERT INTO staff_users (username,password_hash,name,email) VALUES (?,?,?,?)", [`support_${suffix}`,"synthetic-not-login-capable","Synthetic Support Staff",`support_${suffix}@example.invalid`]); staffId = id(staff);
    await pool.execute("INSERT INTO operations_scope_grants (staff_user_id,scope_type,team_id,granted_by) VALUES (?,'TEAM',?,'support-integration')", [staffId,teamId]);
    threadId = randomUUID(); messageId = randomUUID();
    await pool.execute(`INSERT INTO operations_support_threads (id,customer_reference,team_id,unread_count,sla_due_at,last_message_at)
      VALUES (?, ?, ?, 1, UTC_TIMESTAMP()+INTERVAL 1 DAY, UTC_TIMESTAMP())`, [threadId,`TSH-SUPPORT-${suffix}`,teamId]);
    await pool.execute(`INSERT INTO operations_support_messages
      (id,provider_message_id,thread_id,channel,direction,customer_reference,sanitized_body,actor_reference,audit_reference,occurred_at)
      VALUES (?,? ,?,'EMAIL','INBOUND',?,'Synthetic status request','customer','audit-synthetic',UTC_TIMESTAMP())`, [messageId,`provider-${suffix}`,threadId,`TSH-SUPPORT-${suffix}`]);
  });
  afterAll(async () => { await pool.end(); });

  it("loads persisted thread/message evidence and applies replay-safe concurrent commands", async () => {
    expect(await repository.list()).toEqual(expect.arrayContaining([expect.objectContaining({ threadId, unreadCount: 1, teamId: expect.any(Number) })]));
    expect(await repository.get(threadId)).toMatchObject({ threadId, version: 0, messages: [{ messageId, sanitizedBody: "Synthetic status request" }] });
    const command = { commandId: `claim-${suffix}`, expectedVersion: 0, actorStaffId: staffId, occurredAt: "2026-08-26T12:00:00.000Z", action: "CLAIM" as const };
    expect(await repository.apply(threadId, command)).toMatchObject({ state: "ASSIGNED", assignedStaffId: staffId, version: 1 });
    expect(await repository.apply(threadId, { ...command, occurredAt: '2026-08-26T12:00:03.000Z' })).toMatchObject({ state: "ASSIGNED", version: 1 });
    await expect(repository.apply(threadId, { ...command, action: "START" })).rejects.toThrow("SUPPORT_COMMAND_IDEMPOTENCY_CONFLICT");
    await expect(repository.apply(threadId, { ...command, commandId: `stale-${suffix}` })).rejects.toThrow("SUPPORT_THREAD_VERSION_CONFLICT");
    const noteId = randomUUID(); expect(await repository.apply(threadId, { commandId: `note-${suffix}`, expectedVersion: 1, actorStaffId: staffId,
      occurredAt: "2026-08-26T12:01:00.000Z", action: "ADD_INTERNAL_NOTE", noteId, noteBody: "Synthetic internal note" })).toMatchObject({ version: 2,
      internalNotes: [expect.objectContaining({ noteId, body: "Synthetic internal note" })] });
    const [audits] = await pool.query("SELECT id FROM operations_audit_events WHERE resource_type='SUPPORT_THREAD' AND resource_reference=?", [threadId]);
    expect(audits).toHaveLength(2);
  });

  it("keeps message evidence append-only", async () => {
    await expect(pool.execute("UPDATE operations_support_messages SET sanitized_body='changed' WHERE id=?", [messageId])).rejects.toMatchObject({ sqlState: "45000" });
  });

  it('linked history moves with the case and the former owner cannot write after reassignment', async () => {
    const [app] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
      (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status,data_classification,is_test)
      VALUES (?,'single','non-gcc','ROUTE_TEST','regular','synthetic@example.invalid','000',1,100,'under_review','paid','TEST',1)`, [`SUPPORT-OWNER-${suffix}`]);
    const applicationId = id(app);
    const [other] = await pool.execute<ResultSetHeader>("INSERT INTO staff_users (username,password_hash,name,is_active) VALUES (?,'synthetic-unusable','Synthetic successor','active')", [`successor-${suffix}`]);
    const successor = id(other);
    await pool.execute('INSERT INTO operations_case_controls (application_id,assigned_staff_user_id) VALUES (?,?)', [applicationId, staffId]);
    await pool.execute('UPDATE operations_support_threads SET application_id=? WHERE id=?', [applicationId, threadId]);
    expect(await repository.get(threadId)).toMatchObject({ applicationOwnerActorId: `staff:${staffId}` });
    await pool.execute('UPDATE operations_case_controls SET assigned_staff_user_id=?,version=version+1 WHERE application_id=?', [successor, applicationId]);
    const moved = await repository.get(threadId);
    expect(moved).toMatchObject({ applicationOwnerActorId: `staff:${successor}`, assignedStaffId: successor, messages: [{ messageId, sanitizedBody: 'Synthetic status request' }] });
    await expect(repository.apply(threadId, { commandId: randomUUID(), expectedVersion: 2, actorStaffId: staffId, occurredAt: new Date().toISOString(), action: 'ADD_INTERNAL_NOTE', noteId: randomUUID(), noteBody: 'Must be denied' })).rejects.toThrow('SUPPORT_ACCESS_DENIED');
    await expect(repository.apply(threadId, { commandId: randomUUID(), expectedVersion: 2, actorStaffId: successor, occurredAt: new Date().toISOString(), action: 'REASSIGN', targetStaffId: staffId })).rejects.toThrow('SUPPORT_USE_CASE_ASSIGNMENT');
  });
});
