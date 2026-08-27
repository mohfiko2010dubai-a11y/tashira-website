import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AuthorizationActor } from "../authorization/policy";
import { assertSourceClassification, OFFICIAL_SOURCE_POLICY_VERSION, sourceAuthorityTypeSchema, type SourceAuthorityType } from "./source-authority-policy";

export type SourceAuthorityDecision = "APPROVED" | "REJECTED" | "CHANGES_REQUIRED";
export type SourceAuthorityRecord = {
  sourceId: number; authority: string; title: string; sourceUrl: string; classification: "OFFICIAL" | "OPERATIONAL" | "CONDITIONAL" | "INTERNAL";
  sourceState: "ACTIVE" | "INACTIVE"; latestEventId: string | null; policyVersion: string | null; authorityType: SourceAuthorityType | null;
  decision: SourceAuthorityDecision | null; actorReference: string | null; reason: string | null; occurredAt: string | null;
};

export type ReviewSourceAuthorityCommand = {
  sourceId: number; expectedLatestEventId: string | null; commandId: string; authorityType: SourceAuthorityType;
  decision: SourceAuthorityDecision; reason: string; occurredAt: Date;
};

function text(row: object, key: string): string | null { const value = Reflect.get(row, key); return typeof value === "string" ? value : null; }
function number(row: object, key: string): number { const value = Number(Reflect.get(row, key)); if (!Number.isSafeInteger(value) || value < 1) throw new Error("SOURCE_AUTHORITY_EVIDENCE_INVALID"); return value; }
function requirePermission(actor: AuthorizationActor, permission: "rule.read" | "rule.review"): void {
  if (!actor.permissions.has(permission)) throw new Error("SOURCE_AUTHORITY_ACCESS_DENIED");
}
function record(row: object): SourceAuthorityRecord {
  const classification = text(row, "classification"); const sourceState = text(row, "sourceState");
  const authorityTypeValue = text(row, "authorityType"); const authorityType = authorityTypeValue === null ? null : sourceAuthorityTypeSchema.safeParse(authorityTypeValue);
  if (!["OFFICIAL", "OPERATIONAL", "CONDITIONAL", "INTERNAL"].includes(classification ?? "") || !["ACTIVE", "INACTIVE"].includes(sourceState ?? ""))
    throw new Error("SOURCE_AUTHORITY_EVIDENCE_INVALID");
  const authority = text(row, "authority"), title = text(row, "title"), sourceUrl = text(row, "sourceUrl");
  if (!authority || !title || !sourceUrl || authorityType !== null && !authorityType.success) throw new Error("SOURCE_AUTHORITY_EVIDENCE_INVALID");
  return { sourceId: number(row, "sourceId"), authority, title,
    sourceUrl, classification: classification as SourceAuthorityRecord["classification"],
    sourceState: sourceState as SourceAuthorityRecord["sourceState"], latestEventId: text(row, "latestEventId"),
    policyVersion: text(row, "policyVersion"), authorityType: authorityType?.data ?? null,
    decision: text(row, "decision") as SourceAuthorityDecision | null, actorReference: text(row, "actorReference"),
    reason: text(row, "reason"), occurredAt: text(row, "occurredAt") };
}

const fields = `SELECT s.id sourceId,s.authority,s.title,s.source_url sourceUrl,s.classification,s.is_active sourceState,
 e.id latestEventId,e.policy_version policyVersion,e.authority_type authorityType,e.decision,e.actor_reference actorReference,
 DATE_FORMAT(e.occurred_at,'%Y-%m-%dT%H:%i:%s.000Z') occurredAt,e.reason FROM visa_rule_sources s`;
const selectLatest = `${fields} LEFT JOIN visa_rule_source_authority_events e ON e.source_id=s.id
 AND e.id=(SELECT x.id FROM visa_rule_source_authority_events x WHERE x.source_id=s.id ORDER BY x.occurred_at DESC,x.id DESC LIMIT 1)`;

export class MysqlSourceAuthorityRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async list(actor: AuthorizationActor): Promise<readonly SourceAuthorityRecord[]> {
    requirePermission(actor, "rule.read"); const [rows] = await this.pool.query<RowDataPacket[]>(`${selectLatest} ORDER BY s.authority,s.id`); return rows.map(record);
  }

  async review(input: ReviewSourceAuthorityCommand, actor: AuthorizationActor): Promise<SourceAuthorityRecord> {
    requirePermission(actor, "rule.review"); if (!input.reason.trim() || Number.isNaN(input.occurredAt.getTime())) throw new Error("SOURCE_AUTHORITY_REVIEW_EVIDENCE_REQUIRED");
    const connection = await this.pool.getConnection();
    try { await connection.beginTransaction();
      const replay = await this.byEvent(connection, input.commandId);
      if (replay) {
        const same = replay.sourceId === input.sourceId && replay.authorityType === input.authorityType && replay.decision === input.decision
          && replay.reason === input.reason.trim() && replay.actorReference === actor.id;
        if (!same) throw new Error("SOURCE_AUTHORITY_IDEMPOTENCY_CONFLICT"); await connection.commit(); return replay;
      }
      const [sources] = await connection.execute<RowDataPacket[]>("SELECT id,source_url sourceUrl,classification FROM visa_rule_sources WHERE id=? FOR UPDATE", [input.sourceId]);
      const source = sources[0]; if (!source) throw new Error("SOURCE_AUTHORITY_SOURCE_NOT_FOUND");
      const [events] = await connection.execute<RowDataPacket[]>("SELECT id FROM visa_rule_source_authority_events WHERE source_id=? ORDER BY occurred_at DESC,id DESC LIMIT 1", [input.sourceId]);
      const latest = events[0] ? text(events[0], "id") : null; if (latest !== input.expectedLatestEventId) throw new Error("SOURCE_AUTHORITY_VERSION_CONFLICT");
      const classification = text(source, "classification") as SourceAuthorityRecord["classification"];
      if (input.decision === "APPROVED") assertSourceClassification({ classification, authorityType: input.authorityType,
        policyVersion: OFFICIAL_SOURCE_POLICY_VERSION, url: text(source, "sourceUrl") ?? "" });
      await connection.execute(`INSERT INTO visa_rule_source_authority_events
        (id,source_id,policy_version,authority_type,decision,actor_reference,reason,occurred_at) VALUES (?,?,?,?,?,?,?,?)`,
      [input.commandId, input.sourceId, OFFICIAL_SOURCE_POLICY_VERSION, input.authorityType, input.decision, actor.id, input.reason.trim(), input.occurredAt]);
      const result = await this.byEvent(connection, input.commandId); if (!result) throw new Error("SOURCE_AUTHORITY_EVIDENCE_INVALID");
      await connection.commit(); return result;
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  private async byEvent(connection: PoolConnection, eventId: string): Promise<SourceAuthorityRecord | null> {
    const [rows] = await connection.execute<RowDataPacket[]>(`${fields} JOIN visa_rule_source_authority_events e ON e.source_id=s.id WHERE e.id=?`, [eventId]);
    return rows[0] ? record(rows[0]) : null;
  }
}
