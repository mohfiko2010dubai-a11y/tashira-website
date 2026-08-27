import type { OperationsSqlClient } from "../operations/mysql-access-provider";
import { validateSubmissionPolicyThresholds, type OperationalSubmissionPolicy,
  type SubmissionPolicyThresholds } from "./operational-submission-policy";

function value(row: object, key: string): unknown { return (row as Record<string, unknown>)[key]; }
function text(row: object, key: string): string {
  const result = value(row, key); if (typeof result !== "string" || !result) throw new Error("OPERATIONAL_POLICY_INVALID_ROW"); return result;
}
function integer(row: object, key: string): number {
  const result = Number(value(row, key)); if (!Number.isSafeInteger(result)) throw new Error("OPERATIONAL_POLICY_INVALID_ROW"); return result;
}

export class MysqlOperationalSubmissionPolicyProvider {
  private readonly sql: OperationsSqlClient;
  constructor(sql: OperationsSqlClient) { this.sql = sql; }

  async active(at: Date): Promise<OperationalSubmissionPolicy> {
    const rows = await this.sql.query(`SELECT id AS policyId,policy_code AS policyCode,version,classification,
      lifecycle_state AS state,record_version AS recordVersion,thresholds_json AS thresholds,
      source_reference AS sourceReference,effective_from AS effectiveFrom,effective_to AS effectiveTo,evidence_sha256 AS evidenceSha256
      FROM operations_submission_policies
      WHERE policy_code='SUBMISSION_SCHEDULER' AND lifecycle_state='ACTIVE' AND effective_from<=?
        AND (effective_to IS NULL OR effective_to>?) ORDER BY version DESC`, [at, at]);
    if (rows.length !== 1) throw new Error(rows.length ? "OPERATIONAL_POLICY_ACTIVE_CONFLICT" : "OPERATIONAL_POLICY_NOT_CONFIGURED");
    const row = rows[0];
    const raw = value(row, "thresholds");
    const parsed = typeof raw === "string" ? JSON.parse(raw) as SubmissionPolicyThresholds : raw as SubmissionPolicyThresholds;
    return { policyId: text(row, "policyId"), policyCode: "SUBMISSION_SCHEDULER", version: integer(row, "version"),
      classification: "OPERATIONAL", state: "ACTIVE", recordVersion: integer(row, "recordVersion"),
      effectiveFrom: new Date(value(row, "effectiveFrom") as string | Date).toISOString(),
      effectiveTo: value(row, "effectiveTo") === null ? null : new Date(value(row, "effectiveTo") as string | Date).toISOString(),
      sourceReference: text(row, "sourceReference"), thresholds: validateSubmissionPolicyThresholds(parsed),
      evidenceSha256: text(row, "evidenceSha256") };
  }
}
