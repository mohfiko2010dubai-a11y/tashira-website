import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { SupportCommand, SupportThread, SupportThreadState, SupportPriority } from "./support-workflow";
import { SupportThreadWorkflow } from "./support-workflow";
import type { SupportMessage, SupportChannel, SupportDirection } from "./support-inbox";

type SqlValue = string | number | Date | null;
export type SupportThreadResource = SupportThread & { teamId: number; assignedActorId?: string; departmentId?: number };
export type SupportThreadDetail = SupportThreadResource & { messages: readonly SupportMessage[] };

function value(row: object, key: string): unknown { return Reflect.get(row, key); }
function text(row: object, key: string): string { const item = value(row, key); if (typeof item !== "string") throw new Error(`SUPPORT_ROW_INVALID:${key}`); return item; }
function number(row: object, key: string): number { const item = Number(value(row, key)); if (!Number.isSafeInteger(item)) throw new Error(`SUPPORT_ROW_INVALID:${key}`); return item; }
function optionalNumber(row: object, key: string): number | null { const item = value(row, key); if (item === null || item === undefined) return null; const parsed = Number(item); if (!Number.isSafeInteger(parsed)) throw new Error(`SUPPORT_ROW_INVALID:${key}`); return parsed; }
function dateTime(row: object, key: string): string { const item = value(row, key); if (item instanceof Date) return item.toISOString(); if (typeof item === "string" && !Number.isNaN(Date.parse(item))) return new Date(item).toISOString(); throw new Error(`SUPPORT_ROW_INVALID:${key}`); }
async function rows(connection: PoolConnection, sql: string, values: readonly SqlValue[] = []): Promise<RowDataPacket[]> { const [result] = await connection.execute<RowDataPacket[]>(sql, [...values]); return result; }
function digest(value: object): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function threadFromRow(row: object, notes: SupportThread["internalNotes"] = []): SupportThreadResource {
  const assignedStaffId = optionalNumber(row, "assignedStaffId");
  return { threadId: text(row, "threadId"), applicationId: optionalNumber(row, "applicationId"), customerReference: text(row, "customerReference"),
    state: text(row, "state") as SupportThreadState, priority: text(row, "priority") as SupportPriority, assignedStaffId,
    unreadCount: number(row, "unreadCount"), slaDueAt: dateTime(row, "slaDueAt"), version: number(row, "version"), updatedAt: dateTime(row, "updatedAt"),
    internalNotes: notes, teamId: number(row, "teamId"), assignedActorId: assignedStaffId === null ? undefined : `staff:${assignedStaffId}`,
    departmentId: optionalNumber(row, "departmentId") ?? undefined };
}

export class MysqlSupportInboxRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async list(): Promise<readonly SupportThreadResource[]> {
    const connection = await this.pool.getConnection();
    try { return (await rows(connection, `SELECT st.id threadId,st.application_id applicationId,st.customer_reference customerReference,
      st.state,st.priority,st.assigned_staff_user_id assignedStaffId,st.team_id teamId,t.department_id departmentId,
      st.unread_count unreadCount,st.sla_due_at slaDueAt,st.version,st.updated_at updatedAt
      FROM operations_support_threads st JOIN operations_teams t ON t.id=st.team_id
      ORDER BY FIELD(st.priority,'URGENT','HIGH','NORMAL'),st.sla_due_at,st.updated_at DESC`)).map((row) => threadFromRow(row)); }
    finally { connection.release(); }
  }

  async get(threadId: string): Promise<SupportThreadDetail | null> {
    const connection = await this.pool.getConnection();
    try { return await this.loadDetail(connection, threadId, false); } finally { connection.release(); }
  }

  async apply(threadId: string, command: SupportCommand): Promise<SupportThreadDetail> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const commandSha256 = digest(command);
      const current = await this.loadDetail(connection, threadId, true); if (!current) throw new Error("SUPPORT_THREAD_NOT_FOUND");
      const prior = await rows(connection, "SELECT command_sha256 commandSha256,result_json resultJson FROM operations_support_command_events WHERE thread_id=? AND command_id=?", [threadId, command.commandId]);
      if (prior[0]) {
        if (text(prior[0], "commandSha256") !== commandSha256) throw new Error("SUPPORT_COMMAND_IDEMPOTENCY_CONFLICT");
        const stored = value(prior[0], "resultJson"); const parsed = typeof stored === "string" ? JSON.parse(stored) as SupportThreadDetail : stored as SupportThreadDetail;
        await connection.commit(); return parsed;
      }
      if (command.actorStaffId <= 0) throw new Error("SUPPORT_ACTOR_REQUIRED");
      if (command.targetStaffId) {
        const target = await rows(connection, `SELECT s.id FROM staff_users s WHERE s.id=? AND s.is_active='active' AND EXISTS (
          SELECT 1 FROM operations_scope_grants g WHERE g.staff_user_id=s.id AND g.revoked_at IS NULL
          AND (g.scope_type='ALL' OR g.team_id=? OR g.department_id=?)) LIMIT 1`, [command.targetStaffId,current.teamId,current.departmentId??null]);
        if (!target[0]) throw new Error("SUPPORT_TARGET_STAFF_INVALID");
      }
      const next = new SupportThreadWorkflow(current).apply(command);
      const [updated] = await connection.execute<ResultSetHeader>(`UPDATE operations_support_threads SET state=?,assigned_staff_user_id=?,version=?,updated_at=?
        WHERE id=? AND version=?`, [next.state,next.assignedStaffId,next.version,new Date(command.occurredAt),threadId,current.version]);
      if (updated.affectedRows !== 1) throw new Error("SUPPORT_THREAD_VERSION_CONFLICT");
      if (command.action === "ADD_INTERNAL_NOTE") {
        const noteId = command.noteId; const noteBody = command.noteBody;
        if (!noteId || !noteBody) throw new Error("SUPPORT_INTERNAL_NOTE_REQUIRED");
        await connection.execute(`INSERT INTO operations_support_internal_notes
          (id,thread_id,staff_user_id,body,occurred_at) VALUES (?,?,?,?,?)`, [noteId,threadId,command.actorStaffId,noteBody,new Date(command.occurredAt)]);
      }
      const result: SupportThreadDetail = { ...current, ...next, teamId: current.teamId, assignedActorId: next.assignedStaffId === null ? undefined : `staff:${next.assignedStaffId}`,
        departmentId: current.departmentId, messages: current.messages };
      await connection.execute(`INSERT INTO operations_support_command_events
        (id,thread_id,command_id,command_sha256,action,actor_staff_user_id,target_staff_user_id,state_before,state_after,version_before,version_after,result_json,occurred_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [randomUUID(),threadId,command.commandId,commandSha256,command.action,command.actorStaffId,command.targetStaffId??null,
        current.state,next.state,current.version,next.version,JSON.stringify(result),new Date(command.occurredAt)]);
      await connection.execute(`INSERT INTO operations_audit_events
        (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json)
        VALUES (?,'SUPPORT_COMMAND','STAFF',?,'SUPPORT_THREAD',?,'SUCCESS',?,?)`, [randomUUID(),`staff:${command.actorStaffId}`,threadId,command.action,
        JSON.stringify({ commandId: command.commandId, versionBefore: current.version, versionAfter: next.version })]);
      await connection.commit(); return result;
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  private async loadDetail(connection: PoolConnection, threadId: string, lock: boolean): Promise<SupportThreadDetail | null> {
    const found = await rows(connection, `SELECT st.id threadId,st.application_id applicationId,st.customer_reference customerReference,
      st.state,st.priority,st.assigned_staff_user_id assignedStaffId,st.team_id teamId,t.department_id departmentId,
      st.unread_count unreadCount,st.sla_due_at slaDueAt,st.version,st.updated_at updatedAt
      FROM operations_support_threads st JOIN operations_teams t ON t.id=st.team_id WHERE st.id=?${lock ? " FOR UPDATE" : ""}`, [threadId]);
    if (!found[0]) return null;
    const noteRows = await rows(connection, "SELECT id noteId,staff_user_id staffId,body,occurred_at occurredAt FROM operations_support_internal_notes WHERE thread_id=? ORDER BY occurred_at,id", [threadId]);
    const notes = noteRows.map((row) => ({ noteId: text(row, "noteId"), staffId: number(row, "staffId"), body: text(row, "body"), occurredAt: dateTime(row, "occurredAt") }));
    const messageRows = await rows(connection, `SELECT id messageId,provider_message_id providerMessageId,thread_id threadId,channel,direction,application_id applicationId,
      customer_reference customerReference,sanitized_body sanitizedBody,occurred_at occurredAt,actor_reference actorReference,audit_reference auditReference
      FROM operations_support_messages WHERE thread_id=? ORDER BY occurred_at,id`, [threadId]);
    const messages = messageRows.map((row): SupportMessage => ({ messageId: text(row, "messageId"), providerMessageId: text(row, "providerMessageId"), threadId: text(row, "threadId"),
      channel: text(row, "channel") as SupportChannel, direction: text(row, "direction") as SupportDirection, applicationId: optionalNumber(row, "applicationId"),
      customerReference: value(row, "customerReference") === null ? null : text(row, "customerReference"), sanitizedBody: text(row, "sanitizedBody"),
      occurredAt: dateTime(row, "occurredAt"), actorReference: text(row, "actorReference"), auditReference: text(row, "auditReference") }));
    return { ...threadFromRow(found[0], notes), messages };
  }
}
