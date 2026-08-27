import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AuthorizationActor } from "../authorization/policy";
import { evaluateRuleTransition, type RuleGovernanceAction, type RuleVersionStatus } from "./rule-governance";
import { validateVisaRuleImport, type VisaRuleImport } from "./rule-import";
import { assertSourceClassification, sourceAuthorityTypeSchema } from "./source-authority-policy";

export type RuleGovernanceResult = { ruleVersionId: string; stableId: string; version: number; status: RuleVersionStatus; eventId: string };
export type RuleGovernanceHistoryRecord = {
  ruleVersionId: string; stableId: string; version: number; status: RuleVersionStatus; classification: VisaRuleImport["classification"];
  layer: VisaRuleImport["layer"] | null; sourceAuthority: string; sourceTitle: string; sourceUrl: string;
  sourceAuthorityDecision: "APPROVED" | "REJECTED" | "CHANGES_REQUIRED" | null;
  eventId: string; fromStatus: RuleVersionStatus | null; toStatus: RuleVersionStatus; actorReference: string; reason: string; occurredAt: string;
};
function requirePermission(actor: AuthorizationActor, permission: "rule.read" | "rule.propose"): void { if (!actor.permissions.has(permission)) throw new Error("RULE_GOVERNANCE_ACCESS_DENIED"); }
function text(row: object, key: string): string | null { const value = Reflect.get(row, key); return typeof value === "string" ? value : null; }
function integer(row: object, key: string): number { const value = Number(Reflect.get(row, key)); if (!Number.isSafeInteger(value) || value < 1) throw new Error("RULE_GOVERNANCE_EVIDENCE_INVALID"); return value; }
function sha(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function status(value: string | null): RuleVersionStatus {
  if (!value || !["DRAFT", "UNDER_REVIEW", "APPROVED", "ACTIVE", "RETIRED", "REJECTED"].includes(value))
    throw new Error("RULE_GOVERNANCE_EVIDENCE_INVALID");
  return value as RuleVersionStatus;
}

export class MysqlRuleGovernanceRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async list(actor: AuthorizationActor): Promise<readonly RuleGovernanceHistoryRecord[]> {
    requirePermission(actor, "rule.read");
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT v.id ruleVersionId,rs.stable_id stableId,v.version,v.status,v.classification,
      v.rule_layer layer,s.authority sourceAuthority,s.title sourceTitle,s.source_url sourceUrl,a.decision sourceAuthorityDecision,
      e.id eventId,e.from_status fromStatus,e.to_status toStatus,e.actor_reference actorReference,e.reason,
      DATE_FORMAT(e.occurred_at,'%Y-%m-%dT%H:%i:%s.000Z') occurredAt
      FROM visa_rule_versions v JOIN visa_rule_sets rs ON rs.id=v.rule_set_id
      JOIN visa_rule_source_snapshots ss ON ss.id=v.source_snapshot_id JOIN visa_rule_sources s ON s.id=ss.source_id
      JOIN visa_rule_governance_events e ON e.rule_version_id=v.id
      LEFT JOIN visa_rule_source_authority_events a ON a.source_id=s.id AND a.id=(SELECT x.id FROM visa_rule_source_authority_events x
        WHERE x.source_id=s.id ORDER BY x.occurred_at DESC,x.id DESC LIMIT 1)
      ORDER BY e.occurred_at DESC,e.id DESC`);
    return rows.map((row) => {
      const classification = text(row, "classification"), layer = text(row, "layer"), authorityDecision = text(row, "sourceAuthorityDecision");
      const ruleVersionId = text(row, "ruleVersionId"), stableId = text(row, "stableId"), sourceAuthority = text(row, "sourceAuthority");
      const sourceTitle = text(row, "sourceTitle"), sourceUrl = text(row, "sourceUrl"), eventId = text(row, "eventId");
      const actorReference = text(row, "actorReference"), reason = text(row, "reason"), occurredAt = text(row, "occurredAt");
      if (!ruleVersionId || !stableId || !sourceAuthority || !sourceTitle || !sourceUrl || !eventId || !actorReference || !reason || !occurredAt ||
        !classification || !["OFFICIAL", "OPERATIONAL", "CONDITIONAL", "INTERNAL"].includes(classification) ||
        layer !== null && !["BASE_ROUTE", "NATIONALITY_OVERLAY", "RESIDENCE_OVERLAY", "GCC_OVERLAY", "AGE_MINOR_OVERLAY", "FAMILY_OVERLAY", "OPERATIONAL_OVERLAY"].includes(layer) ||
        authorityDecision !== null && !["APPROVED", "REJECTED", "CHANGES_REQUIRED"].includes(authorityDecision)) throw new Error("RULE_GOVERNANCE_EVIDENCE_INVALID");
      return { ruleVersionId, stableId, version: integer(row, "version"), status: status(text(row, "status")),
        classification: classification as VisaRuleImport["classification"], layer: layer as VisaRuleImport["layer"] | null,
        sourceAuthority, sourceTitle, sourceUrl, sourceAuthorityDecision: authorityDecision as RuleGovernanceHistoryRecord["sourceAuthorityDecision"],
        eventId, fromStatus: text(row, "fromStatus") === null ? null : status(text(row, "fromStatus")), toStatus: status(text(row, "toStatus")),
        actorReference, reason, occurredAt };
    });
  }

  async importDraft(input: unknown, commandId: string, actor: AuthorizationActor, occurredAt: Date): Promise<RuleGovernanceResult> {
    requirePermission(actor, "rule.propose"); const rule = validateVisaRuleImport(input); if (Number.isNaN(occurredAt.getTime())) throw new Error("RULE_GOVERNANCE_EVIDENCE_REQUIRED");
    return this.transaction(async (connection) => {
      const payloadSha256 = sha({ kind: "IMPORT", rule, actorId: actor.id });
      const replay = await this.replay(connection, commandId, payloadSha256); if (replay) return replay;
      const sourceId = await this.source(connection, rule); const snapshotId = await this.snapshot(connection, sourceId, rule);
      const ruleSetId = await this.ruleSet(connection, rule);
      const [existing] = await connection.execute<RowDataPacket[]>("SELECT id FROM visa_rule_versions WHERE rule_set_id=? AND version=? FOR UPDATE", [ruleSetId, rule.version]);
      if (existing[0]) throw new Error("RULE_VERSION_ALREADY_EXISTS");
      const versionId = randomUUID();
      await connection.execute(`INSERT INTO visa_rule_versions
        (id,rule_set_id,version,status,classification,research_status,source_snapshot_id,effective_from,effective_to,conditions_json,outcome_json,created_by,rule_layer)
        VALUES (?,?,?,'DRAFT',?,?,?,?,?,?,?,?,?)`, [versionId, ruleSetId, rule.version, rule.classification, rule.researchStatus, snapshotId,
        new Date(rule.effectiveFrom), rule.effectiveTo ? new Date(rule.effectiveTo) : null, JSON.stringify(rule.conditions), JSON.stringify(rule.outcome), actor.id, rule.layer]);
      await this.event(connection, commandId, versionId, null, "DRAFT", actor.id, `RULE_IMPORT:${rule.stableId}:${rule.version}`, payloadSha256, occurredAt);
      return { ruleVersionId: versionId, stableId: rule.stableId, version: rule.version, status: "DRAFT", eventId: commandId };
    });
  }

  async transition(input: { ruleVersionId: string; expectedStatus: RuleVersionStatus; action: RuleGovernanceAction; reason: string; commandId: string;
    environment: "DEVELOPMENT" | "TEST" | "STAGING" | "PRODUCTION"; ownerActivationApproved: boolean; occurredAt: Date }, actor: AuthorizationActor): Promise<RuleGovernanceResult> {
    if (!input.reason.trim() || Number.isNaN(input.occurredAt.getTime())) throw new Error("RULE_GOVERNANCE_EVIDENCE_REQUIRED");
    return this.transaction(async (connection) => {
      const payloadSha256 = sha({ kind: "TRANSITION", ruleVersionId: input.ruleVersionId, expectedStatus: input.expectedStatus,
        action: input.action, reason: input.reason.trim(), environment: input.environment, actorId: actor.id });
      const replay = await this.replay(connection, input.commandId, payloadSha256); if (replay) return replay;
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT v.id ruleVersionId,v.status, v.version,rs.stable_id stableId,v.classification,
        s.source_url sourceUrl,e.policy_version policyVersion,e.authority_type authorityType,e.decision authorityDecision
        FROM visa_rule_versions v JOIN visa_rule_sets rs ON rs.id=v.rule_set_id JOIN visa_rule_source_snapshots ss ON ss.id=v.source_snapshot_id
        JOIN visa_rule_sources s ON s.id=ss.source_id LEFT JOIN visa_rule_source_authority_events e ON e.source_id=s.id
        AND e.id=(SELECT x.id FROM visa_rule_source_authority_events x WHERE x.source_id=s.id ORDER BY x.occurred_at DESC,x.id DESC LIMIT 1)
        WHERE v.id=? FOR UPDATE`, [input.ruleVersionId]);
      const row = rows[0]; if (!row) throw new Error("RULE_VERSION_NOT_FOUND"); const current = status(text(row, "status"));
      if (current !== input.expectedStatus) throw new Error("RULE_GOVERNANCE_VERSION_CONFLICT");
      const decision = evaluateRuleTransition({ currentStatus: current, action: input.action, permissions: actor.permissions,
        environment: input.environment, ownerActivationApproved: input.ownerActivationApproved });
      if (!decision.allowed) throw new Error(`RULE_GOVERNANCE_${decision.reason}`);
      if (["APPROVE", "ACTIVATE"].includes(input.action)) {
        if (text(row, "authorityDecision") !== "APPROVED") throw new Error("RULE_SOURCE_AUTHORITY_APPROVAL_REQUIRED");
        const classification = text(row, "classification");
        const authorityType = sourceAuthorityTypeSchema.safeParse(text(row, "authorityType"));
        if (!classification || !["OFFICIAL", "OPERATIONAL", "CONDITIONAL", "INTERNAL"].includes(classification) || !authorityType.success)
          throw new Error("RULE_SOURCE_AUTHORITY_APPROVAL_REQUIRED");
        assertSourceClassification({ classification: classification as VisaRuleImport["classification"], authorityType: authorityType.data,
          policyVersion: text(row, "policyVersion") ?? "", url: text(row, "sourceUrl") ?? "" });
      }
      if (input.action === "ACTIVATE") {
        const [active] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM visa_rule_versions WHERE rule_set_id=(SELECT rule_set_id FROM visa_rule_versions WHERE id=?) AND status='ACTIVE' AND id<>? FOR UPDATE",
          [input.ruleVersionId, input.ruleVersionId]);
        if (active[0]) throw new Error("RULE_ACTIVE_VERSION_CONFLICT");
      }
      const [updateResult] = await connection.execute("UPDATE visa_rule_versions SET status=? WHERE id=? AND status=?", [decision.resultingStatus, input.ruleVersionId, current]);
      if (Number(Reflect.get(updateResult, "affectedRows")) !== 1) throw new Error("RULE_GOVERNANCE_VERSION_CONFLICT");
      if (input.action === "APPROVE" || input.action === "REJECT") await connection.execute(`INSERT INTO visa_rule_reviews
        (id,rule_version_id,decision,reviewer_reference,comment,created_at) VALUES (?,?,?,?,?,?)`, [randomUUID(), input.ruleVersionId,
        input.action === "APPROVE" ? "APPROVED" : "REJECTED", actor.id, input.reason.trim(), input.occurredAt]);
      await this.event(connection, input.commandId, input.ruleVersionId, current, decision.resultingStatus, actor.id, input.reason.trim(), payloadSha256, input.occurredAt);
      return { ruleVersionId: input.ruleVersionId, stableId: text(row, "stableId") ?? "", version: integer(row, "version"), status: decision.resultingStatus, eventId: input.commandId };
    });
  }

  private async source(connection: PoolConnection, rule: VisaRuleImport): Promise<number> {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT id,authority,title,classification FROM visa_rule_sources WHERE source_url_sha256=UNHEX(SHA2(?,256)) FOR UPDATE", [rule.source.url]);
    if (rows[0]) {
      if (text(rows[0], "authority") !== rule.source.authority || text(rows[0], "title") !== rule.source.title || text(rows[0], "classification") !== rule.classification)
        throw new Error("RULE_SOURCE_IDENTITY_CONFLICT"); return integer(rows[0], "id");
    }
    const [result] = await connection.execute("INSERT INTO visa_rule_sources (authority,title,source_url,classification) VALUES (?,?,?,?)",
      [rule.source.authority, rule.source.title, rule.source.url, rule.classification]); return Number(Reflect.get(result, "insertId"));
  }
  private async snapshot(connection: PoolConnection, sourceId: number, rule: VisaRuleImport): Promise<string> {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT id FROM visa_rule_source_snapshots WHERE source_id=? AND fingerprint_sha256=?", [sourceId, rule.source.fingerprintSha256]);
    if (rows[0]) return text(rows[0], "id") ?? ""; const id = randomUUID();
    await connection.execute(`INSERT INTO visa_rule_source_snapshots (id,source_id,retrieved_at,fingerprint_sha256,content_reference,retrieval_status)
      VALUES (?,?,?,?,?,'SUCCESS')`, [id, sourceId, new Date(rule.source.retrievedAt), rule.source.fingerprintSha256, `RULE_IMPORT:${rule.stableId}:${rule.version}`]); return id;
  }
  private async ruleSet(connection: PoolConnection, rule: VisaRuleImport): Promise<number> {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT id,route_code routeCode,profile_code profileCode FROM visa_rule_sets WHERE stable_id=? FOR UPDATE", [rule.stableId]);
    if (rows[0]) { if (text(rows[0], "routeCode") !== rule.routeCode || text(rows[0], "profileCode") !== rule.profileCode) throw new Error("RULE_SET_IDENTITY_CONFLICT"); return integer(rows[0], "id"); }
    const [result] = await connection.execute("INSERT INTO visa_rule_sets (stable_id,route_code,profile_code) VALUES (?,?,?)", [rule.stableId, rule.routeCode, rule.profileCode]); return Number(Reflect.get(result, "insertId"));
  }
  private async event(connection: PoolConnection, id: string, versionId: string, from: RuleVersionStatus | null, to: RuleVersionStatus,
    actor: string, reason: string, payloadSha256: string, occurredAt: Date) { await connection.execute(`INSERT INTO visa_rule_governance_events
      (id,rule_version_id,from_status,to_status,actor_reference,reason,payload_sha256,occurred_at) VALUES (?,?,?,?,?,?,?,?)`, [id, versionId, from, to, actor, reason, payloadSha256, occurredAt]); }
  private async replay(connection: PoolConnection, id: string, expectedPayloadSha256: string): Promise<RuleGovernanceResult | null> { const [rows] = await connection.execute<RowDataPacket[]>(`SELECT e.id eventId,e.rule_version_id ruleVersionId,e.to_status status,e.payload_sha256 payloadSha256,v.version,rs.stable_id stableId
    FROM visa_rule_governance_events e JOIN visa_rule_versions v ON v.id=e.rule_version_id JOIN visa_rule_sets rs ON rs.id=v.rule_set_id WHERE e.id=?`, [id]);
    if (!rows[0]) return null;
    if (text(rows[0], "payloadSha256") !== expectedPayloadSha256) throw new Error("RULE_GOVERNANCE_IDEMPOTENCY_CONFLICT");
    return { eventId: id, ruleVersionId: text(rows[0], "ruleVersionId") ?? "", stableId: text(rows[0], "stableId") ?? "",
      version: integer(rows[0], "version"), status: status(text(rows[0], "status")) }; }
  private async transaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> { const connection = await this.pool.getConnection(); try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; }
    catch (error) { await connection.rollback(); throw error; } finally { connection.release(); } }
}
