import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AuthorizationActor } from "../authorization/policy";
import { validateSubmissionPolicyThresholds, type OperationalPolicyState,
  type SubmissionPolicyThresholds } from "./operational-submission-policy";

const transitions: Readonly<Record<OperationalPolicyState, readonly OperationalPolicyState[]>> = {
  DRAFT: ["REVIEW"], REVIEW: ["APPROVED", "REJECTED"], APPROVED: ["ACTIVE"],
  ACTIVE: ["SUPERSEDED"], REJECTED: ["DRAFT"], SUPERSEDED: [],
};
function permission(state: OperationalPolicyState) {
  if (state === "DRAFT" || state === "REVIEW") return "rule.propose" as const;
  if (state === "APPROVED" || state === "REJECTED") return "rule.review" as const;
  return "rule.activate" as const;
}
function requirePermission(actor: AuthorizationActor, required: "rule.read" | "rule.propose" | "rule.review" | "rule.activate") {
  if (!actor.permissions.has(required)) throw new Error("OPERATIONAL_POLICY_ACCESS_DENIED");
}
async function tx<T>(pool: Pool, work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
function sha(payload: unknown) { return createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }

export class MysqlOperationalPolicyGovernanceRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async propose(input: { version: number; thresholds: SubmissionPolicyThresholds; effectiveFrom: Date; effectiveTo: Date | null;
    sourceReference: string; reason: string }, actor: AuthorizationActor, occurredAt: Date) {
    requirePermission(actor, "rule.propose");
    const thresholds = validateSubmissionPolicyThresholds(input.thresholds);
    if (!input.reason.trim() || !input.sourceReference.trim()) throw new Error("OPERATIONAL_POLICY_EVIDENCE_REQUIRED");
    const id = randomUUID(); const evidence = sha({ code: "SUBMISSION_SCHEDULER", version: input.version, thresholds,
      effectiveFrom: input.effectiveFrom.toISOString(), effectiveTo: input.effectiveTo?.toISOString() ?? null, sourceReference: input.sourceReference });
    return tx(this.pool, async (connection) => {
      await connection.execute(`INSERT INTO operations_submission_policies
        (id,policy_code,version,lifecycle_state,record_version,thresholds_json,source_reference,effective_from,effective_to,created_by,evidence_sha256)
        VALUES (?,'SUBMISSION_SCHEDULER',?,'DRAFT',1,?,?,?,?,?,?)`, [id, input.version, JSON.stringify(thresholds),
        input.sourceReference.trim(), input.effectiveFrom, input.effectiveTo, actor.id, evidence]);
      await this.event(connection, id, null, "DRAFT", 0, 1, actor.id, input.reason, evidence, occurredAt);
      return { policyId: id, state: "DRAFT" as const, recordVersion: 1, evidenceSha256: evidence };
    });
  }

  async transition(input: { policyId: string; expectedVersion: number; toState: OperationalPolicyState; reason: string }, actor: AuthorizationActor, occurredAt: Date) {
    requirePermission(actor, permission(input.toState));
    if (!input.reason.trim()) throw new Error("OPERATIONAL_POLICY_REASON_REQUIRED");
    return tx(this.pool, async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT lifecycle_state state,record_version recordVersion,evidence_sha256 evidenceSha256
        FROM operations_submission_policies WHERE id=? FOR UPDATE`, [input.policyId]);
      const row = rows[0]; if (!row) throw new Error("OPERATIONAL_POLICY_NOT_FOUND");
      const state = String(row.state) as OperationalPolicyState; const version = Number(row.recordVersion);
      if (version !== input.expectedVersion) throw new Error("OPERATIONAL_POLICY_VERSION_CONFLICT");
      if (!transitions[state].includes(input.toState)) throw new Error("OPERATIONAL_POLICY_TRANSITION_INVALID");
      if (input.toState === "ACTIVE") {
        const [active] = await connection.execute<RowDataPacket[]>(`SELECT id,record_version recordVersion,evidence_sha256 evidenceSha256
          FROM operations_submission_policies WHERE policy_code='SUBMISSION_SCHEDULER' AND lifecycle_state='ACTIVE' AND id<>? FOR UPDATE`, [input.policyId]);
        for (const previous of active) {
          const previousVersion = Number(previous.recordVersion);
          await connection.execute(`UPDATE operations_submission_policies SET lifecycle_state='SUPERSEDED',record_version=record_version+1,effective_to=? WHERE id=?`, [occurredAt, previous.id]);
          await this.event(connection, String(previous.id), "ACTIVE", "SUPERSEDED", previousVersion, previousVersion + 1,
            actor.id, `SUPERSEDED_BY:${input.policyId}`, String(previous.evidenceSha256), occurredAt);
        }
      }
      const approval = input.toState === "APPROVED" ? ",approved_by=?,approved_at=?" : "";
      const activation = input.toState === "ACTIVE" ? ",activated_by=?,activated_at=?" : "";
      const parameters: (string | number | Date)[] = [input.toState];
      if (input.toState === "APPROVED") parameters.push(actor.id, occurredAt);
      if (input.toState === "ACTIVE") parameters.push(actor.id, occurredAt);
      parameters.push(input.policyId, input.expectedVersion);
      const [result] = await connection.execute(`UPDATE operations_submission_policies SET lifecycle_state=?,record_version=record_version+1${approval}${activation} WHERE id=? AND record_version=?`, parameters);
      if (Reflect.get(result, "affectedRows") !== 1) throw new Error("OPERATIONAL_POLICY_VERSION_CONFLICT");
      await this.event(connection, input.policyId, state, input.toState, version, version + 1, actor.id,
        input.reason.trim(), String(row.evidenceSha256), occurredAt);
      return { policyId: input.policyId, state: input.toState, recordVersion: version + 1 };
    });
  }

  async list(actor: AuthorizationActor): Promise<readonly object[]> {
    requirePermission(actor, "rule.read");
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT id policyId,policy_code policyCode,version,lifecycle_state state,
      record_version recordVersion,thresholds_json thresholds,source_reference sourceReference,effective_from effectiveFrom,
      effective_to effectiveTo,created_by createdBy,approved_by approvedBy,approved_at approvedAt,activated_by activatedBy,
      activated_at activatedAt,evidence_sha256 evidenceSha256 FROM operations_submission_policies ORDER BY version DESC`);
    return rows;
  }

  async history(policyId: string, actor: AuthorizationActor): Promise<readonly object[]> {
    requirePermission(actor, "rule.read");
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT id eventId,from_state fromState,to_state toState,version_before versionBefore,
      version_after versionAfter,actor_reference actorReference,reason,payload_sha256 payloadSha256,occurred_at occurredAt
      FROM operations_submission_policy_events WHERE policy_id=? ORDER BY version_after,occurred_at`, [policyId]);
    return rows;
  }

  private async event(connection: PoolConnection, policyId: string, from: OperationalPolicyState | null, to: OperationalPolicyState,
    before: number, after: number, actor: string, reason: string, payloadSha256: string, occurredAt: Date) {
    await connection.execute(`INSERT INTO operations_submission_policy_events
      (id,policy_id,from_state,to_state,version_before,version_after,actor_reference,reason,payload_sha256,occurred_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, [randomUUID(), policyId, from, to, before, after, actor, reason.trim(), payloadSha256, occurredAt]);
  }
}
