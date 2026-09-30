import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { requiredDocuments, tripPurposeSchema } from "../../contracts/document-requirement-engine";
import { loadOwnerDocumentEvidence, projectOwnerDocuments } from "./customer/owner-document-evidence";
import type { OperationsSqlClient } from "./operations/mysql-access-provider";

/** Caller holds the application row lock; completion and document write commit together. */
export async function recordDocumentCompletion(connection: PoolConnection, applicationId: number) {
  const [existing] = await connection.execute<RowDataPacket[]>("SELECT documents_completed_at FROM application_service_clocks WHERE application_id=?", [applicationId]);
  if (existing[0]?.documents_completed_at) return;
  const [people] = await connection.execute<RowDataPacket[]>(`SELECT a.id,a.nationality,a.gcc_residence_country AS residenceCountry,
    app.visa_type AS visaType,app.residence_type AS residenceType,
    (SELECT JSON_UNQUOTE(JSON_EXTRACT(e.profile_json,'$.tripPurpose')) FROM customer_interview_profile_events e
      WHERE e.application_id=a.application_id AND e.applicant_id=a.id ORDER BY e.profile_version DESC LIMIT 1) AS tripPurpose
    FROM applicants a JOIN applications app ON app.id=a.application_id WHERE a.application_id=?`, [applicationId]);
  if (!people.length || people.some(p => !p.nationality || !p.residenceCountry || !tripPurposeSchema.safeParse(p.tripPurpose).success)) return;
  const sql: OperationsSqlClient = { query: async (query, parameters = []) => { const [rows] = await connection.execute<RowDataPacket[]>(query, [...parameters]); return rows; } };
  const evidence = await loadOwnerDocumentEvidence(sql, applicationId);
  const complete = people.every(person => {
    const rules = requiredDocuments({ nationality: String(person.nationality), country_of_residence: String(person.residenceCountry),
      visa_type: String(person.visaType), residence_type: String(person.residenceType), trip_purpose: tripPurposeSchema.parse(person.tripPurpose) });
    return rules.length > 0 && projectOwnerDocuments(rules, evidence, Number(person.id)).every(item => ["UPLOADED", "VALIDATED", "WAIVED"].includes(item.state));
  });
  if (complete) await connection.execute(`INSERT INTO application_service_clocks (application_id,documents_completed_at) VALUES (?,NOW(3))
    ON DUPLICATE KEY UPDATE documents_completed_at=COALESCE(documents_completed_at,VALUES(documents_completed_at))`, [applicationId]);
}

/** The controlled visa_processing transition means sent to the authority, not customer submission. */
export async function recordAuthoritySubmission(connection: PoolConnection, applicationId: number, actor: string) {
  await connection.execute(`INSERT INTO application_service_clocks (application_id,authority_submitted_at,submission_actor) VALUES (?,NOW(3),?)
    ON DUPLICATE KEY UPDATE submission_actor=IF(authority_submitted_at IS NULL,VALUES(submission_actor),submission_actor),
      authority_submitted_at=COALESCE(authority_submitted_at,VALUES(authority_submitted_at))`, [applicationId, actor]);
}
