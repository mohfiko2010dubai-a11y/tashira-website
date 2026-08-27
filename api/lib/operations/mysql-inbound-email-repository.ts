import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { NormalizedInboundSupportEmail } from "./inbound-email-adapter";
import type { InboundEmailIngestionResult, InboundEmailRepository } from "./inbound-email-service";

function text(row: object, key: string): string | null { const value = Reflect.get(row, key); return typeof value === "string" ? value : null; }

export class MysqlInboundEmailRepository implements InboundEmailRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async ingest(input: NormalizedInboundSupportEmail): Promise<InboundEmailIngestionResult> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const duplicate = await this.byProviderIdentity(connection, input.providerIdentity);
      if (duplicate) {
        if (duplicate.evidenceSha256 !== input.evidenceSha256) throw new Error("INBOUND_EMAIL_IDEMPOTENCY_CONFLICT");
        await connection.commit();
        return { state: "DUPLICATE", threadId: duplicate.threadId, messageId: duplicate.messageId };
      }
      const [owned] = await connection.execute<RowDataPacket[]>(`SELECT a.id FROM applications a
        JOIN operations_case_controls c ON c.application_id=a.id WHERE a.id=? AND a.reference_number=? AND c.team_id=? FOR UPDATE`,
      [input.applicationId, input.applicationReference, input.teamId]);
      if (!owned[0]) throw new Error("INBOUND_EMAIL_APPLICATION_SCOPE_INVALID");
      const [threads] = await connection.execute<RowDataPacket[]>(`SELECT id FROM operations_support_threads
        WHERE application_id=? AND team_id=? AND state<>'RESOLVED' ORDER BY updated_at DESC,id DESC LIMIT 1 FOR UPDATE`, [input.applicationId, input.teamId]);
      const threadId = text(threads[0] ?? {}, "id") ?? randomUUID();
      const occurredAt = new Date(input.receivedAt), messageId = randomUUID(), auditId = randomUUID();
      if (!threads[0]) await connection.execute(`INSERT INTO operations_support_threads
        (id,application_id,customer_reference,state,priority,team_id,unread_count,sla_due_at,version,last_message_at)
        VALUES (?,?,?,'UNASSIGNED','NORMAL',?,0,DATE_ADD(?,INTERVAL 24 HOUR),0,?)`,
      [threadId, input.applicationId, input.applicationReference, input.teamId, occurredAt, occurredAt]);
      await connection.execute(`INSERT INTO operations_audit_events
        (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json)
        VALUES (?,'SUPPORT_EMAIL_INGESTED','SYSTEM',?,'SUPPORT_THREAD',?,'SUCCESS','VERIFIED_PROVIDER_EMAIL',?)`,
      [auditId, `email-sender-sha256:${input.senderReferenceSha256}`, threadId, JSON.stringify({ providerIdentity: input.providerIdentity,
        evidenceSha256: input.evidenceSha256, attachmentCountIgnored: input.attachmentCount })]);
      await connection.execute(`INSERT INTO operations_support_messages
        (id,provider_message_id,thread_id,channel,direction,application_id,customer_reference,sanitized_body,actor_reference,audit_reference,occurred_at)
        VALUES (?,?,?,'EMAIL','INBOUND',?,?,?,?,?,?)`, [messageId, input.providerIdentity, threadId, input.applicationId,
        input.applicationReference, input.sanitizedBody, `email-sender-sha256:${input.senderReferenceSha256}`, auditId, occurredAt]);
      await connection.execute(`UPDATE operations_support_threads SET unread_count=unread_count+1,last_message_at=?,version=version+1
        WHERE id=?`, [occurredAt, threadId]);
      await connection.commit();
      return { state: "INGESTED", threadId, messageId };
    } catch (error) {
      await connection.rollback();
      if (error instanceof Error && Reflect.get(error, "code") === "ER_DUP_ENTRY") {
        const duplicate = await this.byProviderIdentity(connection, input.providerIdentity);
        if (duplicate && duplicate.evidenceSha256 === input.evidenceSha256)
          return { state: "DUPLICATE", threadId: duplicate.threadId, messageId: duplicate.messageId };
      }
      throw error;
    } finally { connection.release(); }
  }

  private async byProviderIdentity(connection: PoolConnection, providerIdentity: string): Promise<{ threadId: string; messageId: string; evidenceSha256: string } | null> {
    const [rows] = await connection.execute<RowDataPacket[]>(`SELECT m.thread_id threadId,m.id messageId,a.metadata_json metadataJson
      FROM operations_support_messages m JOIN operations_audit_events a ON a.id=m.audit_reference WHERE m.provider_message_id=? LIMIT 1 FOR UPDATE`, [providerIdentity]);
    if (!rows[0]) return null;
    const metadataValue = Reflect.get(rows[0], "metadataJson");
    const metadata = typeof metadataValue === "string" ? JSON.parse(metadataValue) as object : metadataValue as object;
    const threadId = text(rows[0], "threadId"), messageId = text(rows[0], "messageId"), evidenceSha256 = text(metadata, "evidenceSha256");
    if (!threadId || !messageId || !evidenceSha256) throw new Error("INBOUND_EMAIL_EVIDENCE_INVALID");
    return { threadId, messageId, evidenceSha256 };
  }
}
