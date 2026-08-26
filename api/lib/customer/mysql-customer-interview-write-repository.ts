import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type CustomerApplicantProfile = {
  fullName: string;
  nationality: string | null;
  residenceCountry: string | null;
};

export type CustomerApplicantWriteResult = {
  applicantId: number;
  applicantIndex: number;
  profileVersion: number;
  profile: CustomerApplicantProfile;
  replayed: boolean;
};

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseProfile(value: unknown): CustomerApplicantProfile {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (typeof parsed !== "object" || parsed === null) throw new Error("CUSTOMER_PROFILE_EVIDENCE_INVALID");
  const fullName = Reflect.get(parsed, "fullName");
  const nationality = Reflect.get(parsed, "nationality");
  const residenceCountry = Reflect.get(parsed, "residenceCountry");
  if (typeof fullName !== "string" || !fullName.trim()
    || (nationality !== null && typeof nationality !== "string")
    || (residenceCountry !== null && typeof residenceCountry !== "string")) throw new Error("CUSTOMER_PROFILE_EVIDENCE_INVALID");
  return { fullName, nationality, residenceCountry };
}

async function transaction<T>(pool: Pool, work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

async function replay(connection: PoolConnection, input: { applicationId: number; idempotencyKey: string; commandSha256: string }): Promise<CustomerApplicantWriteResult | null> {
  const [rows] = await connection.execute<RowDataPacket[]>(`SELECT e.applicant_id AS applicantId,a.applicant_index AS applicantIndex,
    e.profile_version AS profileVersion,e.profile_json AS profile,e.command_sha256 AS commandSha256
    FROM customer_interview_profile_events e JOIN applicants a ON a.id=e.applicant_id AND a.application_id=e.application_id
    WHERE e.application_id=? AND e.idempotency_key=? LIMIT 1`, [input.applicationId, input.idempotencyKey]);
  const row = rows[0]; if (!row) return null;
  if (String(row.commandSha256) !== input.commandSha256) throw new Error("CUSTOMER_INTERVIEW_IDEMPOTENCY_CONFLICT");
  return { applicantId: Number(row.applicantId), applicantIndex: Number(row.applicantIndex), profileVersion: Number(row.profileVersion),
    profile: parseProfile(row.profile), replayed: true };
}

export class MysqlCustomerInterviewWriteRepository {
  constructor(private readonly pool: Pool) {}

  async addApplicant(input: { applicationId: number; profile: CustomerApplicantProfile; reason: string; actorReference: string;
    idempotencyKey: string; occurredAt: Date }): Promise<CustomerApplicantWriteResult> {
    const commandSha256 = digest({ type: "ADD_APPLICANT", applicationId: input.applicationId, profile: input.profile, reason: input.reason });
    return transaction(this.pool, async (connection) => {
      const [applications] = await connection.execute<RowDataPacket[]>("SELECT id FROM applications WHERE id=? FOR UPDATE", [input.applicationId]);
      if (!applications[0]) throw new Error("CUSTOMER_APPLICATION_NOT_FOUND");
      const existing = await replay(connection, { ...input, commandSha256 }); if (existing) return existing;
      const [applicants] = await connection.execute<RowDataPacket[]>("SELECT applicant_index AS applicantIndex FROM applicants WHERE application_id=? ORDER BY applicant_index FOR UPDATE", [input.applicationId]);
      const applicantIndex = applicants.length ? Math.max(...applicants.map((row) => Number(row.applicantIndex))) + 1 : 0;
      const [insert] = await connection.execute<ResultSetHeader>(`INSERT INTO applicants
        (application_id,applicant_index,full_name,nationality,gcc_residence_country,profile_version) VALUES (?,?,?,?,?,1)`,
      [input.applicationId, applicantIndex, input.profile.fullName, input.profile.nationality, input.profile.residenceCountry]);
      const applicantId = Number(insert.insertId); const eventId = randomUUID();
      await connection.execute(`INSERT INTO customer_interview_profile_events
        (id,application_id,applicant_id,profile_version,event_type,profile_json,reason,actor_reference,command_sha256,idempotency_key,occurred_at)
        VALUES (?,?,?,1,'CREATED',?,?,?,?,?,?)`, [eventId, input.applicationId, applicantId, JSON.stringify(input.profile), input.reason,
        input.actorReference, commandSha256, input.idempotencyKey, input.occurredAt]);
      return { applicantId, applicantIndex, profileVersion: 1, profile: structuredClone(input.profile), replayed: false };
    });
  }

  async editApplicant(input: { applicationId: number; applicantId: number; expectedVersion: number; profile: CustomerApplicantProfile;
    reason: string; actorReference: string; idempotencyKey: string; occurredAt: Date }): Promise<CustomerApplicantWriteResult> {
    const commandSha256 = digest({ type: "EDIT_APPLICANT", applicationId: input.applicationId, applicantId: input.applicantId,
      expectedVersion: input.expectedVersion, profile: input.profile, reason: input.reason });
    return transaction(this.pool, async (connection) => {
      const [applications] = await connection.execute<RowDataPacket[]>("SELECT id FROM applications WHERE id=? FOR UPDATE", [input.applicationId]);
      if (!applications[0]) throw new Error("CUSTOMER_APPLICATION_NOT_FOUND");
      const existing = await replay(connection, { ...input, commandSha256 }); if (existing) return existing;
      const [rows] = await connection.execute<RowDataPacket[]>("SELECT applicant_index AS applicantIndex,profile_version AS profileVersion FROM applicants WHERE id=? AND application_id=? FOR UPDATE",
        [input.applicantId, input.applicationId]);
      const row = rows[0]; if (!row) throw new Error("CUSTOMER_APPLICANT_OWNERSHIP_INVALID");
      if (Number(row.profileVersion) !== input.expectedVersion) throw new Error("CUSTOMER_APPLICANT_VERSION_CONFLICT");
      const nextVersion = input.expectedVersion + 1;
      const [updated] = await connection.execute<ResultSetHeader>(`UPDATE applicants SET full_name=?,nationality=?,gcc_residence_country=?,profile_version=?
        WHERE id=? AND application_id=? AND profile_version=?`, [input.profile.fullName, input.profile.nationality, input.profile.residenceCountry,
        nextVersion, input.applicantId, input.applicationId, input.expectedVersion]);
      if (updated.affectedRows !== 1) throw new Error("CUSTOMER_APPLICANT_VERSION_CONFLICT");
      await connection.execute(`INSERT INTO customer_interview_profile_events
        (id,application_id,applicant_id,profile_version,event_type,profile_json,reason,actor_reference,command_sha256,idempotency_key,occurred_at)
        VALUES (?,?,?,?, 'UPDATED',?,?,?,?,?,?)`, [randomUUID(), input.applicationId, input.applicantId, nextVersion, JSON.stringify(input.profile),
        input.reason, input.actorReference, commandSha256, input.idempotencyKey, input.occurredAt]);
      return { applicantId: input.applicantId, applicantIndex: Number(row.applicantIndex), profileVersion: nextVersion,
        profile: structuredClone(input.profile), replayed: false };
    });
  }
}
