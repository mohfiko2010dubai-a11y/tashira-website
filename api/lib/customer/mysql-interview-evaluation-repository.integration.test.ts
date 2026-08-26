import { randomUUID } from "node:crypto";
import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { describe, expect, it } from "vitest";
import type { EligibilityEvaluationResult } from "../eligibility/eligibility-engine";
import { MysqlInterviewEvaluationRepository } from "./mysql-interview-evaluation-repository";

const databaseUrl = process.env.INTERVIEW_EVALUATION_REHEARSAL_DATABASE_URL;
const result: EligibilityEvaluationResult = {
  matchedRuleIds: [], matchedRuleVersions: [], sourceAuthorities: [], matchedRules: [], reason: "Synthetic eligible route",
  finalEligibilityState: "ELIGIBLE", requiredDocuments: ["PASSPORT"],
  conditionalDocuments: [{ code: "RETURN_TICKET", reason: "When requested" }], manualReviewReason: null,
};

describe.skipIf(!databaseUrl)("MySQL interview evaluation requirement persistence", () => {
  it("creates immutable applicant requirements atomically and verifies exact replay", async () => {
    if (!databaseUrl) throw new Error("INTERVIEW_EVALUATION_REHEARSAL_DATABASE_URL_REQUIRED");
    const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2 }); const runId = randomUUID();
    try {
      const [application] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
        (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status)
        VALUES (?,'single','non-gcc','ROUTE_TEST','regular','synthetic@example.invalid','000',1,100,'submitted','pending')`, [`EVAL-${runId}`]);
      const [applicant] = await pool.execute<ResultSetHeader>(`INSERT INTO applicants
        (application_id,applicant_index,full_name,nationality) VALUES (?,0,'Synthetic Applicant','EG')`, [application.insertId]);
      const repository = new MysqlInterviewEvaluationRepository(pool); const input = { applicationId: Number(application.insertId),
        evaluations: [{ applicantId: Number(applicant.insertId), selectedRoute: "ROUTE_TEST", result }], triggerEventId: `trigger-${runId}`,
        catalogVersion: "synthetic-catalog-v1", actorReference: "staging-test:evaluation", reason: "Synthetic completion", evaluatedAt: new Date() };
      const persisted = await repository.persistCompleted(input);
      expect(persisted).toMatchObject([{ applicantId: Number(applicant.insertId), replayed: false }]);
      expect(await repository.persistCompleted(input)).toEqual([{ ...persisted[0], replayed: true }]);
      const [requirements] = await pool.execute<RowDataPacket[]>(`SELECT i.requirement_code AS code,i.catalog_version AS catalogVersion,
        i.critical,i.conditional,e.state FROM applicant_requirement_instances i
        JOIN applicant_requirement_events e ON e.requirement_instance_id=i.id
        WHERE i.application_id=? AND i.applicant_id=? ORDER BY i.requirement_code`, [application.insertId, applicant.insertId]);
      expect(requirements).toEqual([
        { code: "PASSPORT", catalogVersion: "synthetic-catalog-v1", critical: 1, conditional: 0, state: "MISSING" },
        { code: "RETURN_TICKET", catalogVersion: "synthetic-catalog-v1", critical: 0, conditional: 1, state: "CONDITIONAL_PENDING" },
      ]);
    } finally { await pool.end(); }
  });
});
