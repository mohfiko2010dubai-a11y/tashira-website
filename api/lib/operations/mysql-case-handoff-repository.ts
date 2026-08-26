import { createHash } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { HumanHandoff } from "./human-handoff";
import type {
  CaseHandoffPersistenceInput,
  CaseHandoffRepository,
} from "../customer/case-handoff-runtime";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function parsedMetadata(row: RowDataPacket): {
  handoff: HumanHandoff;
  requestFingerprint: string;
} {
  const raw = row.metadataJson as string | object;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as {
    handoff: HumanHandoff;
    requestFingerprint: string;
  };
}

export class MysqlCaseHandoffRepository implements CaseHandoffRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async create(input: CaseHandoffPersistenceInput): Promise<HumanHandoff> {
    const connection = await this.pool.getConnection();
    const providerId = `case-handoff:${input.applicationId}:${input.handoffId}`;
    try {
      await connection.beginTransaction();
      const existing = await this.loadByProviderId(connection, providerId);
      if (existing) {
        if (existing.requestFingerprint !== input.requestFingerprint)
          throw new Error("CASE_HANDOFF_IDEMPOTENCY_CONFLICT");
        await connection.commit();
        return existing.handoff;
      }
      const deadline = new Date(
        Date.parse(input.createdAt) + 24 * 60 * 60 * 1000
      );
      await connection.execute(
        `INSERT INTO operations_support_threads
        (id,application_id,customer_reference,state,priority,team_id,unread_count,sla_due_at,version,last_message_at)
        VALUES (?,?,?,'UNASSIGNED','NORMAL',?,1,?,0,?)`,
        [
          input.conversationId,
          input.applicationId,
          input.customerReference,
          input.teamId,
          deadline,
          new Date(input.createdAt),
        ]
      );
      await connection.execute(
        `INSERT INTO operations_audit_events
        (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json)
        VALUES (?,'CASE_HANDOFF_CREATED','CUSTOMER',?,'SUPPORT_THREAD',?,'SUCCESS',?,?)`,
        [
          input.auditReference,
          `application:${input.applicationId}`,
          input.conversationId,
          input.trigger,
          JSON.stringify({
            handoff: input,
            requestFingerprint: input.requestFingerprint,
            evidenceDigest: digest(JSON.stringify(input)),
          }),
        ]
      );
      await connection.execute(
        `INSERT INTO operations_support_messages
        (id,provider_message_id,thread_id,channel,direction,application_id,customer_reference,sanitized_body,actor_reference,audit_reference,occurred_at)
        VALUES (?,?,?,'CHAT','INBOUND',?,?,?,?,?,?)`,
        [
          input.handoffId,
          providerId,
          input.conversationId,
          input.applicationId,
          input.customerReference,
          `Customer requested specialist review for ${input.customerQuestion}.`,
          `application:${input.applicationId}`,
          input.auditReference,
          new Date(input.createdAt),
        ]
      );
      await connection.commit();
      return input;
    } catch (error) {
      await connection.rollback();
      if (error instanceof Error && Reflect.get(error, "code") === "ER_DUP_ENTRY") {
        const existing = await this.loadByProviderId(connection, providerId);
        if (existing) {
          if (existing.requestFingerprint !== input.requestFingerprint) throw new Error("CASE_HANDOFF_IDEMPOTENCY_CONFLICT");
          return existing.handoff;
        }
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  private async loadByProviderId(
    connection: PoolConnection,
    providerId: string
  ) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT a.metadata_json metadataJson
      FROM operations_support_messages m JOIN operations_audit_events a ON a.id=m.audit_reference
      WHERE m.provider_message_id=? LIMIT 1 FOR UPDATE`,
      [providerId]
    );
    return rows[0] ? parsedMetadata(rows[0]) : null;
  }
}
