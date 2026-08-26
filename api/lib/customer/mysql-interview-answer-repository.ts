import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { QuestionCatalogDefinition } from "../requirements/requirement-catalog";
import { InMemoryInterviewAnswerHistory, type InterviewAnswer, type InterviewAnswerEvent } from "./dynamic-interview";

function hash(answer: InterviewAnswer): string { return createHash("sha256").update(JSON.stringify(answer)).digest("hex"); }
export function parseStoredInterviewAnswer(value: unknown, answerType: QuestionCatalogDefinition["answerType"]): InterviewAnswer {
  if (answerType === "BOOLEAN") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1" || value === 1) return true;
    if (value === "false" || value === "0" || value === 0) return false;
  } else if (answerType === "NUMBER") {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  } else if (typeof value === "string") {
    if (value.startsWith('"') && value.endsWith('"')) {
      const parsed = JSON.parse(value) as unknown; if (typeof parsed === "string") return parsed;
    }
    return value;
  }
  throw new Error("INTERVIEW_STORED_ANSWER_INVALID");
}
async function transaction<T>(pool: Pool, work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export class MysqlInterviewAnswerRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async all(applicationId: number): Promise<readonly InterviewAnswerEvent[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(`SELECT e.id AS eventId,e.application_id AS applicationId,e.applicant_id AS applicantId,
      e.question_definition_id AS questionDefinitionId,e.question_definition_version AS questionDefinitionVersion,e.answer_json AS answer,
      e.answer_sha256 AS answerSha256,e.supersedes_event_id AS supersedesEventId,e.change_reason AS changeReason,e.occurred_at AS occurredAt,
      q.answer_type AS answerType FROM dynamic_interview_answer_events e JOIN requirement_question_definitions q ON q.id=e.question_definition_id
      WHERE e.application_id=? ORDER BY e.occurred_at,e.id`, [applicationId]);
    return rows.map((row) => ({ eventId: String(row.eventId), applicationId: Number(row.applicationId),
      applicantId: row.applicantId === null ? null : Number(row.applicantId), questionDefinitionId: String(row.questionDefinitionId),
      questionDefinitionVersion: Number(row.questionDefinitionVersion),
      answer: parseStoredInterviewAnswer(row.answer, String(row.answerType) as QuestionCatalogDefinition["answerType"]), answerSha256: String(row.answerSha256),
      supersedesEventId: row.supersedesEventId === null ? null : String(row.supersedesEventId), changeReason: String(row.changeReason),
      occurredAt: new Date(row.occurredAt as Date | string).toISOString() }));
  }

  async append(input: { applicationId: number; applicantId: number | null; definition: QuestionCatalogDefinition;
    answer: InterviewAnswer; changeReason: string; actorReference: string; occurredAt: Date }): Promise<InterviewAnswerEvent> {
    const validator = new InMemoryInterviewAnswerHistory();
    validator.append({ applicationId: input.applicationId, applicantId: input.applicantId, questionDefinitionId: input.definition.definitionId,
      questionDefinitionVersion: input.definition.version, answer: input.answer, changeReason: input.changeReason || "INITIAL_ANSWER",
      occurredAt: input.occurredAt.toISOString(), definition: input.definition });
    return transaction(this.pool, async (connection) => {
      const [applications] = await connection.execute<RowDataPacket[]>("SELECT id FROM applications WHERE id=? FOR UPDATE", [input.applicationId]);
      if (!applications[0]) throw new Error("INTERVIEW_APPLICATION_NOT_FOUND");
      if (input.applicantId !== null) {
        const [applicants] = await connection.execute<RowDataPacket[]>("SELECT id FROM applicants WHERE id=? AND application_id=?", [input.applicantId, input.applicationId]);
        if (!applicants[0]) throw new Error("INTERVIEW_APPLICANT_OWNERSHIP_INVALID");
      }
      const [previousRows] = await connection.execute<RowDataPacket[]>(`SELECT id,answer_sha256 AS answerSha256 FROM dynamic_interview_answer_events
        WHERE application_id=? AND applicant_id <=> ? AND question_definition_id=? ORDER BY occurred_at DESC,id DESC LIMIT 1`,
      [input.applicationId, input.applicantId, input.definition.definitionId]);
      const previous = previousRows[0]; const answerSha256 = hash(input.answer);
      if (previous && String(previous.answerSha256) === answerSha256) {
        const events = await this.all(input.applicationId);
        const existing = events.find((event) => event.eventId === String(previous.id));
        if (!existing) throw new Error("INTERVIEW_IDEMPOTENCY_LOOKUP_FAILED");
        return existing;
      }
      if (previous && !input.changeReason.trim()) throw new Error("INTERVIEW_CHANGE_REASON_REQUIRED");
      const eventId = randomUUID();
      await connection.execute(`INSERT INTO dynamic_interview_answer_events (id,application_id,applicant_id,question_definition_id,
        question_definition_version,answer_json,answer_sha256,supersedes_event_id,change_reason,actor_type,actor_reference,occurred_at)
        VALUES (?,?,?,?,?,?,?,?,?,'CUSTOMER',?,?)`, [eventId, input.applicationId, input.applicantId, input.definition.definitionId,
        input.definition.version, JSON.stringify(input.answer), answerSha256, previous ? String(previous.id) : null,
        input.changeReason.trim() || "INITIAL_ANSWER", input.actorReference, input.occurredAt]);
      return { eventId, applicationId: input.applicationId, applicantId: input.applicantId, questionDefinitionId: input.definition.definitionId,
        questionDefinitionVersion: input.definition.version, answer: input.answer, answerSha256,
        supersedesEventId: previous ? String(previous.id) : null, changeReason: input.changeReason.trim() || "INITIAL_ANSWER",
        occurredAt: input.occurredAt.toISOString() };
    });
  }
}
