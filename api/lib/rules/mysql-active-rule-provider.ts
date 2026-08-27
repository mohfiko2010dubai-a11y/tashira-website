import { z } from "zod";
import type { EligibilityRule } from "../eligibility/eligibility-engine";
import type { OperationsSqlClient } from "../operations/mysql-access-provider";
import { ruleClassificationSchema, ruleLayerSchema } from "./rule-import";
import { assertSourceClassification, sourceAuthorityTypeSchema } from "./source-authority-policy";

const conditionSchema = z.array(z.object({
  field: z.string().min(1).max(100),
  operator: z.enum(["EQUALS", "IN", "NOT_IN", "EXISTS"]),
  value: z.union([z.string(), z.array(z.string())]).optional(),
}).strict());

const outcomeSchema = z.object({
  eligibility: z.enum(["NO_CHANGE", "ELIGIBLE", "INELIGIBLE", "HUMAN_REVIEW_REQUIRED"]),
  requirementCodes: z.array(z.string().min(1).max(100)),
  conditionalDocuments: z.array(z.object({
    code: z.string().min(1).max(100),
    reason: z.string().min(1).max(500),
    when: z.object({
      questionCode: z.string().min(1).max(100),
      operator: z.enum(["EQUALS", "IN"]),
      value: z.union([z.string(), z.array(z.string())]),
    }).strict().optional(),
  }).strict()).default([]),
  explanationCode: z.string().min(1).max(500),
}).strict();

function field(row: object, key: string): unknown { return Reflect.get(row, key); }
function stringField(row: object, key: string): string | null {
  const value = field(row, key);
  return typeof value === "string" && value.trim() ? value : null;
}
function numberField(row: object, key: string): number | null {
  const parsed = Number(field(row, key));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
function dateField(row: object, key: string): Date | null {
  const value = field(row, key);
  const parsed = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}
function jsonField(row: object, key: string): unknown {
  const value = field(row, key);
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return undefined; }
}

/** Loads only governed customer-eligible rule evidence. Invalid ACTIVE evidence fails closed. */
export class MysqlActiveRuleProvider {
  private readonly sql: OperationsSqlClient;
  constructor(sql: OperationsSqlClient) { this.sql = sql; }

  async activeForRoute(routeCode: string): Promise<EligibilityRule[]> {
    const rows = await this.sql.query(
      `SELECT v.version,v.classification,v.rule_layer AS ruleLayer,
              v.effective_from AS effectiveFrom,v.effective_to AS effectiveTo,
              v.conditions_json AS conditionsJson,v.outcome_json AS outcomeJson,
              rs.stable_id AS stableId,rs.route_code AS routeCode,s.authority,s.source_url AS sourceUrl,
              sae.authority_type AS authorityType,sae.policy_version AS authorityPolicyVersion,
              sae.decision AS authorityDecision
         FROM visa_rule_versions v
         JOIN visa_rule_sets rs ON rs.id=v.rule_set_id
         JOIN visa_rule_source_snapshots ss ON ss.id=v.source_snapshot_id
         JOIN visa_rule_sources s ON s.id=ss.source_id
         JOIN visa_rule_source_authority_events sae ON sae.source_id=s.id
          AND sae.id=(SELECT latest.id FROM visa_rule_source_authority_events latest
                       WHERE latest.source_id=s.id ORDER BY latest.occurred_at DESC,latest.id DESC LIMIT 1)
        WHERE v.status='ACTIVE'
          AND v.research_status='VALIDATED'
          AND v.rule_layer IS NOT NULL
          AND v.classification <> 'INTERNAL'
          AND ss.retrieval_status='SUCCESS'
          AND s.is_active='ACTIVE'
          AND sae.decision='APPROVED'
          AND rs.route_code=?
        ORDER BY rs.stable_id,v.version`, [routeCode],
    );
    return rows.map((row) => {
      const id = stringField(row, "stableId");
      const version = numberField(row, "version");
      const storedRoute = stringField(row, "routeCode");
      const authority = stringField(row, "authority");
      const sourceUrl = stringField(row, "sourceUrl");
      const authorityType = sourceAuthorityTypeSchema.safeParse(stringField(row, "authorityType"));
      const authorityPolicyVersion = stringField(row, "authorityPolicyVersion");
      const authorityDecision = stringField(row, "authorityDecision");
      const layer = ruleLayerSchema.safeParse(stringField(row, "ruleLayer"));
      const classification = ruleClassificationSchema.safeParse(stringField(row, "classification"));
      const effectiveFrom = dateField(row, "effectiveFrom");
      const effectiveToValue = field(row, "effectiveTo");
      const effectiveTo = effectiveToValue === null ? null : dateField(row, "effectiveTo");
      const conditions = conditionSchema.safeParse(jsonField(row, "conditionsJson"));
      const outcome = outcomeSchema.safeParse(jsonField(row, "outcomeJson"));
      if (!id || !version || storedRoute !== routeCode || !authority || !sourceUrl || !authorityType.success
        || !authorityPolicyVersion || authorityDecision !== "APPROVED" || !layer.success
        || !classification.success || !effectiveFrom || effectiveToValue !== null && !effectiveTo
        || !conditions.success || !outcome.success) {
        throw new Error("ACTIVE_RULE_EVIDENCE_INVALID");
      }
      try {
        assertSourceClassification({ classification: classification.data, authorityType: authorityType.data,
          policyVersion: authorityPolicyVersion, url: sourceUrl });
      } catch {
        throw new Error("ACTIVE_RULE_SOURCE_AUTHORITY_INVALID");
      }
      return {
        id, version, routeCode, layer: layer.data, classification: classification.data,
        sourceAuthority: authority, reason: outcome.data.explanationCode,
        effectiveFrom, effectiveTo, conditions: conditions.data,
        eligibilityEffect: outcome.data.eligibility,
        requiredDocuments: outcome.data.requirementCodes,
        conditionalDocuments: outcome.data.conditionalDocuments,
      } satisfies EligibilityRule;
    });
  }
}
