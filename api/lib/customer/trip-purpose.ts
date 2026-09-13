import { tripPurposeSchema, type TripPurpose } from "../../../contracts/document-requirement-engine";
import type { OperationsSqlClient } from "../operations/mysql-access-provider";

/** Reuse the existing versioned profile JSON; no schema migration or extra PII. */
export async function loadTripPurposes(sql: OperationsSqlClient, applicationId: number): Promise<Map<number, TripPurpose>> {
  const rows = await sql.query(`SELECT e.applicant_id AS applicantId,JSON_UNQUOTE(JSON_EXTRACT(e.profile_json,'$.tripPurpose')) AS tripPurpose
    FROM customer_interview_profile_events e
    WHERE e.application_id=? AND e.profile_version=(SELECT MAX(latest.profile_version)
      FROM customer_interview_profile_events latest WHERE latest.application_id=e.application_id AND latest.applicant_id=e.applicant_id)`, [applicationId]);
  const purposes = new Map<number, TripPurpose>();
  for (const row of rows) {
    const purpose = tripPurposeSchema.safeParse(Reflect.get(row, "tripPurpose"));
    if (purpose.success) purposes.set(Number(Reflect.get(row, "applicantId")), purpose.data);
  }
  return purposes;
}
