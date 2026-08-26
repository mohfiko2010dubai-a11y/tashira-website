import { randomUUID } from "node:crypto";
import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { describe, expect, it } from "vitest";
import type { QuestionCatalogDefinition } from "../requirements/requirement-catalog";
import { MysqlInterviewAnswerRepository } from "./mysql-interview-answer-repository";

const databaseUrl = process.env.INTERVIEW_ANSWER_REHEARSAL_DATABASE_URL;

describe.skipIf(!databaseUrl)("MySQL Dynamic Interview answer transitions", () => {
  it("preserves A to B to A as three immutable chronological events", async () => {
    if (!databaseUrl) throw new Error("INTERVIEW_ANSWER_REHEARSAL_DATABASE_URL_REQUIRED");
    const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2 }); const runId = randomUUID();
    const definitionId = randomUUID();
    const definition: QuestionCatalogDefinition = { kind: "QUESTION", definitionId, code: `COUNTRY_${runId.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      version: 1, status: "ACTIVE", customerLabel: "Synthetic country", shortCustomerExplanation: "Synthetic rehearsal only",
      internalLabel: "Synthetic country", classification: "OFFICIAL", authoritySemantics: "Synthetic authority",
      reasonTemplate: "Synthetic reason", effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: null,
      reviewStatus: "APPROVED", questionType: "PROFILE", helpText: "", answerType: "SELECT", allowedValues: ["EG", "PK"],
      validationContract: {}, customerVisible: true };
    try {
      const [application] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
        (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status)
        VALUES (?,'single','non-gcc','ROUTE_TEST','regular','synthetic@example.invalid','000',1,100,'submitted','pending')`, [`ANSWER-${runId}`]);
      const [applicant] = await pool.execute<ResultSetHeader>(`INSERT INTO applicants
        (application_id,applicant_index,full_name,nationality) VALUES (?,0,'Synthetic Applicant','EG')`, [application.insertId]);
      await pool.execute(`INSERT INTO requirement_question_definitions
        (id,stable_code,version,status,question_type,customer_label,short_customer_explanation,internal_label,classification,
          authority_semantics,reason_template,help_text,answer_type,allowed_values_json,validation_contract_json,customer_visible,
          effective_from,created_by,review_status,reviewed_by,reviewed_at,source_metadata_json,governance_state)
        VALUES (?,?,1,'ACTIVE','PROFILE','Synthetic country','Synthetic rehearsal only','Synthetic country','OFFICIAL',
          'Synthetic authority','Synthetic reason','','SELECT',JSON_ARRAY('EG','PK'),JSON_OBJECT(),TRUE,
          '2026-01-01','synthetic-test','APPROVED','synthetic-test',NOW(3),JSON_OBJECT(),'ACTIVE')`, [definitionId, definition.code]);
      const repository = new MysqlInterviewAnswerRepository(pool); const common = { applicationId: Number(application.insertId),
        applicantId: Number(applicant.insertId), definition, changeReason: "Synthetic correction", actorReference: "staging-test:answer" };
      const first = await repository.append({ ...common, answer: "EG", occurredAt: new Date("2026-08-26T10:00:00Z") });
      const second = await repository.append({ ...common, answer: "PK", occurredAt: new Date("2026-08-26T10:01:00Z") });
      const third = await repository.append({ ...common, answer: "EG", occurredAt: new Date("2026-08-26T10:02:00Z") });
      expect(second.supersedesEventId).toBe(first.eventId); expect(third.supersedesEventId).toBe(second.eventId);
      const [events] = await pool.execute<RowDataPacket[]>(`SELECT answer_json AS answer,supersedes_event_id AS supersedesEventId
        FROM dynamic_interview_answer_events WHERE application_id=? ORDER BY occurred_at,id`, [application.insertId]);
      expect(events.map((row) => String(row.answer))).toEqual(["EG", "PK", "EG"]);
      expect(events[2].supersedesEventId).toBe(second.eventId);
    } finally { await pool.end(); }
  });
});
