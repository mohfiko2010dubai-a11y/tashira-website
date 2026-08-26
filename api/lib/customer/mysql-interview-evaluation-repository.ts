import { createHash } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { createEvaluationEvidence, type EvaluationEvidenceSnapshot } from "../eligibility/evaluation-evidence";
import type { EligibilityEvaluationResult } from "../eligibility/eligibility-engine";

function deterministicId(input: string): string {
  const hash = createHash("sha256").update(input).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

type SqlValue = string | number | Date | null;
async function rows(connection: PoolConnection, sql: string, values: readonly SqlValue[] = []): Promise<RowDataPacket[]> {
  const [result] = await connection.execute<RowDataPacket[]>(sql, [...values]); return result;
}

export type CompletedApplicantEvaluation = { applicantId: number; selectedRoute: string; result: EligibilityEvaluationResult };

/** Persists the canonical completed-interview evaluation as immutable evidence with replay-safe deterministic IDs. */
export class MysqlInterviewEvaluationRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async persistCompleted(input: { applicationId: number; evaluations: readonly CompletedApplicantEvaluation[]; triggerEventId: string;
    actorReference: string; reason: string; evaluatedAt: Date }): Promise<readonly { applicantId: number; evaluationId: string; replayed: boolean }[]> {
    if (input.evaluations.length === 0 || new Set(input.evaluations.map(({ applicantId }) => applicantId)).size !== input.evaluations.length) {
      throw new Error("INTERVIEW_EVALUATION_APPLICANTS_INVALID");
    }
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const applications = await rows(connection, "SELECT id FROM applications WHERE id=? FOR UPDATE", [input.applicationId]);
      if (!applications[0]) throw new Error("INTERVIEW_APPLICATION_NOT_FOUND");
      const results: { applicantId: number; evaluationId: string; replayed: boolean }[] = [];
      for (const evaluation of input.evaluations) {
        const applicants = await rows(connection, "SELECT id FROM applicants WHERE id=? AND application_id=? FOR UPDATE",
          [evaluation.applicantId, input.applicationId]);
        if (!applicants[0]) throw new Error("INTERVIEW_APPLICANT_OWNERSHIP_INVALID");
        const evaluationId = deterministicId(`${input.applicationId}:${evaluation.applicantId}:${input.triggerEventId}`);
        const previous = await rows(connection, `SELECT evaluation_id AS evaluationId FROM visa_rule_evaluation_selections
          WHERE application_id=? AND applicant_id=? AND evaluation_id<>? ORDER BY selected_at DESC,id DESC LIMIT 1 FOR UPDATE`,
        [input.applicationId, evaluation.applicantId, evaluationId]);
        const snapshot = createEvaluationEvidence({ evaluationId, applicationId: input.applicationId, applicantId: evaluation.applicantId,
          selectedRoute: evaluation.selectedRoute, evaluatedAt: input.evaluatedAt, result: evaluation.result,
          supersedesEvaluationId: previous[0] ? String(previous[0].evaluationId) : null, reevaluationReason: input.reason });
        const existing = await rows(connection, "SELECT evidence_sha256 AS evidenceSha256 FROM visa_rule_evaluation_runs WHERE id=?", [evaluationId]);
        if (existing[0]) {
          if (String(existing[0].evidenceSha256) !== snapshot.evidenceSha256) throw new Error("INTERVIEW_EVALUATION_IDEMPOTENCY_CONFLICT");
          const selections = await rows(connection, `SELECT id FROM visa_rule_evaluation_selections
            WHERE application_id=? AND applicant_id=? AND evaluation_id=? LIMIT 1`, [input.applicationId, evaluation.applicantId, evaluationId]);
          if (!selections[0]) throw new Error("INTERVIEW_EVALUATION_REPLAY_INCOMPLETE");
          results.push({ applicantId: evaluation.applicantId, evaluationId, replayed: true }); continue;
        }
        await this.persistSnapshot(connection, snapshot);
        await connection.execute(`INSERT INTO visa_rule_evaluation_selections
          (id,application_id,applicant_id,evaluation_id,selection_reason,selected_by,selected_at) VALUES (?,?,?,?,?,?,?)`,
        [deterministicId(`selection:${evaluationId}`), input.applicationId, evaluation.applicantId, evaluationId,
          input.reason, input.actorReference, input.evaluatedAt]);
        results.push({ applicantId: evaluation.applicantId, evaluationId, replayed: false });
      }
      await connection.commit(); return results;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  private async persistSnapshot(connection: PoolConnection, snapshot: EvaluationEvidenceSnapshot): Promise<void> {
    await connection.execute(`INSERT INTO visa_rule_evaluation_runs
      (id,application_id,applicant_id,route_code,engine_version,final_eligibility_state,decision_reason,manual_review_reason,
       reevaluation_reason,required_documents_json,conditional_documents_json,warnings_json,precedence_trace_json,
       supersedes_evaluation_id,evidence_sha256,evaluated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [snapshot.evaluationId, snapshot.applicationId, snapshot.applicantId, snapshot.selectedRoute, snapshot.engineVersion,
      snapshot.eligibilityState, snapshot.reason, snapshot.manualReviewReason, snapshot.reevaluationReason,
      JSON.stringify(snapshot.requiredDocuments), JSON.stringify(snapshot.conditionalDocuments), JSON.stringify(snapshot.warnings),
      JSON.stringify(snapshot.precedenceTrace), snapshot.supersedesEvaluationId, snapshot.evidenceSha256, new Date(snapshot.evaluatedAt)]);
    for (const [index, match] of snapshot.matchedRules.entries()) {
      const versions = await rows(connection, `SELECT v.id FROM visa_rule_versions v JOIN visa_rule_sets s ON s.id=v.rule_set_id
        WHERE s.stable_id=? AND v.version=? LIMIT 2`, [match.ruleId, match.ruleVersion]);
      if (versions.length !== 1) throw new Error("INTERVIEW_MATCHED_RULE_VERSION_UNAVAILABLE");
      await connection.execute(`INSERT INTO visa_rule_evaluation_matches
        (evaluation_id,sequence_number,rule_version_id,stable_rule_id,rule_version_number,rule_layer,classification,source_authority,match_reason)
        VALUES (?,?,?,?,?,?,?,?,?)`, [snapshot.evaluationId, index + 1, String(versions[0].id), match.ruleId, match.ruleVersion,
        match.layer, match.classification, match.sourceAuthority, match.reason]);
    }
    if (snapshot.eligibilityState === "RULE_CONFLICT") await connection.execute(`INSERT INTO visa_rule_evaluation_conflicts
      (id,evaluation_id,conflict_code,conflict_detail) VALUES (?,?,?,?)`,
    [deterministicId(`conflict:${snapshot.evaluationId}`), snapshot.evaluationId, "RULE_CONFLICT", snapshot.reason]);
  }
}
