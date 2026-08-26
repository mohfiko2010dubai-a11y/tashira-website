import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  OperationsEmailEvent,
  OperationsEmailEvidence,
} from "./operations-email-events";

export type QueueOperationsEmailInput = {
  timelineEventId: string;
  event: OperationsEmailEvent;
  templateVersion: string;
  deduplicationKey: string;
  occurredAt: string;
};

export interface OperationsEmailRepository {
  queue(input: QueueOperationsEmailInput): Promise<OperationsEmailEvidence>;
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value)))
    return new Date(value).toISOString();
  throw new Error("OPERATIONS_EMAIL_TIMESTAMP_INVALID");
}
function evidence(row: RowDataPacket): OperationsEmailEvidence {
  return {
    evidenceId: String(row.evidenceId),
    applicationId: Number(row.applicationId),
    event: String(row.event) as OperationsEmailEvent,
    eventReference: String(row.eventReference),
    templateVersion: String(row.templateVersion),
    recipientReference: `sha256:${String(row.recipientSha256)}`,
    providerMessageId: row.providerMessageId
      ? String(row.providerMessageId)
      : null,
    deliveryStatus: String(
      row.deliveryStatus
    ) as OperationsEmailEvidence["deliveryStatus"],
    occurredAt: iso(row.occurredAt),
    deduplicationKey: String(row.deduplicationKey),
  };
}

export class MysqlOperationsEmailRepository implements OperationsEmailRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async queue(
    input: QueueOperationsEmailInput
  ): Promise<OperationsEmailEvidence> {
    const connection = await this.pool.getConnection();
    const commandSha256 = sha(JSON.stringify(input));
    try {
      await connection.beginTransaction();
      const prior = await this.load(connection, input.deduplicationKey, true);
      if (prior) {
        if (String(prior.commandSha256) !== commandSha256)
          throw new Error("OPERATIONS_EMAIL_IDEMPOTENCY_CONFLICT");
        await connection.commit();
        return evidence(prior);
      }
      const [sources] = await connection.execute<RowDataPacket[]>(
        `SELECT e.application_id applicationId,e.event_name eventName,a.contact_email contactEmail
        FROM application_timeline_events e JOIN applications a ON a.id=e.application_id WHERE e.id=? LIMIT 1 FOR UPDATE`,
        [input.timelineEventId]
      );
      const source = sources[0];
      if (!source || String(source.eventName) !== input.event)
        throw new Error("OPERATIONS_EMAIL_TRUSTED_EVENT_REQUIRED");
      const recipient = String(source.contactEmail ?? "")
        .trim()
        .toLowerCase();
      if (!recipient || !recipient.includes("@"))
        throw new Error("OPERATIONS_EMAIL_RECIPIENT_REQUIRED");
      const dispatchId = randomUUID();
      await connection.execute(
        `INSERT INTO operations_email_dispatches
        (id,application_id,timeline_event_id,event_name,template_version,recipient_sha256,deduplication_key,command_sha256,created_at)
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          dispatchId,
          Number(source.applicationId),
          input.timelineEventId,
          input.event,
          input.templateVersion,
          sha(recipient),
          input.deduplicationKey,
          commandSha256,
          new Date(input.occurredAt),
        ]
      );
      await connection.execute(
        `INSERT INTO operations_email_dispatch_events
        (id,dispatch_id,delivery_status,provider_message_id,failure_category,occurred_at) VALUES (?,?,'QUEUED',NULL,NULL,?)`,
        [randomUUID(), dispatchId, new Date(input.occurredAt)]
      );
      const created = await this.load(
        connection,
        input.deduplicationKey,
        false
      );
      if (!created) throw new Error("OPERATIONS_EMAIL_QUEUE_WRITE_FAILED");
      await connection.commit();
      return evidence(created);
    } catch (error) {
      await connection.rollback();
      if (
        error instanceof Error &&
        Reflect.get(error, "code") === "ER_DUP_ENTRY"
      ) {
        const prior = await this.load(
          connection,
          input.deduplicationKey,
          false
        );
        if (prior) {
          if (String(prior.commandSha256) !== commandSha256)
            throw new Error("OPERATIONS_EMAIL_IDEMPOTENCY_CONFLICT");
          return evidence(prior);
        }
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  private async load(
    connection: PoolConnection,
    deduplicationKey: string,
    lock: boolean
  ) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT d.id evidenceId,d.application_id applicationId,d.timeline_event_id eventReference,
      d.event_name event,d.template_version templateVersion,d.recipient_sha256 recipientSha256,d.deduplication_key deduplicationKey,
      d.command_sha256 commandSha256,x.delivery_status deliveryStatus,x.provider_message_id providerMessageId,x.occurred_at occurredAt
      FROM operations_email_dispatches d JOIN operations_email_dispatch_events x ON x.dispatch_id=d.id
      WHERE d.deduplication_key=? ORDER BY x.occurred_at DESC,x.id DESC LIMIT 1${lock ? " FOR UPDATE" : ""}`,
      [deduplicationKey]
    );
    return rows[0] ?? null;
  }
}
