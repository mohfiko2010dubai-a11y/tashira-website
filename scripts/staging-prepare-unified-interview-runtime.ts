import { createPool, type RowDataPacket } from "mysql2/promise";
import { env } from "../api/lib/env";
import { MysqlCustomerInterviewWriteRepository } from "../api/lib/customer/mysql-customer-interview-write-repository";

const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_UNIFIED_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_UNIFIED_PATH_IDENTITY_FAILED");

const references = ["TSH-STG-DYN-INDIVIDUAL", "TSH-STG-DYN-GCC-FUTURE", "TSH-STG-DYN-FAMILY",
  "TSH-STG-DYN-NOT-RESEARCHED", "TSH-STG-DYN-CONFLICT"] as const;
const pool = createPool({ uri: env.databaseUrl, connectionLimit: 2 });
const repository = new MysqlCustomerInterviewWriteRepository(pool);
const now = new Date("2026-08-26T12:00:00.000Z");

try {
  const [applicationRows] = await pool.execute<RowDataPacket[]>(`SELECT id,reference_number AS reference FROM applications
    WHERE reference_number IN (${references.map(() => "?").join(",")}) ORDER BY id`, [...references]);
  if (applicationRows.length !== references.length) throw new Error("STAGING_UNIFIED_APPLICATION_FIXTURES_INCOMPLETE");
  for (const application of applicationRows) {
    const applicationId = Number(application.id); const reference = String(application.reference);
    const [applicantRows] = await pool.execute<RowDataPacket[]>(`SELECT id,applicant_index AS applicantIndex FROM applicants
      WHERE application_id=? ORDER BY applicant_index,id`, [applicationId]);
    if (applicantRows.length === 0) throw new Error(`STAGING_UNIFIED_APPLICANTS_MISSING:${reference}`);
    const applicantIds = applicantRows.map((row) => Number(row.id)); const lead = applicantIds[0];
    if (reference === "TSH-STG-DYN-FAMILY") {
      const relationships = ["SPOUSE", "CHILD", "CHILD"] as const;
      if (applicantIds.length !== 4) throw new Error("STAGING_UNIFIED_FAMILY_SIZE_INVALID");
      for (let index = 1; index < applicantIds.length; index += 1) await repository.defineRelationship({
        applicationId, fromApplicantId: lead, toApplicantId: applicantIds[index], relationship: relationships[index - 1],
        reason: "Synthetic Staging family relationship", actorReference: "staging-system:unified-interview-fixture",
        idempotencyKey: `staging-unified-relationship-${applicationId}-${index}`, occurredAt: now,
      });
    }
    const [groupRows] = await pool.execute<RowDataPacket[]>("SELECT id FROM travel_groups WHERE application_id=?", [applicationId]);
    if (groupRows.length === 0) await repository.createTravelGroup({ applicationId, group: {
      reference: "Synthetic Trip A", applicantIds, primaryTravellerId: lead, accompanyingAdultId: applicantIds.length > 1 ? lead : null,
      arrangement: "TOGETHER", origin: "TEST_ORIGIN", destination: "DXB", plannedArrivalDate: "2027-01-20",
      plannedDepartureDate: "2027-02-01", ticketStatus: "NOT_BOOKED",
    }, reason: "Synthetic Staging unified interview trip", actorReference: "staging-system:unified-interview-fixture",
    idempotencyKey: `staging-unified-travel-${applicationId}`, occurredAt: now });
  }
  const [flags] = await pool.execute<RowDataPacket[]>(`SELECT flag_key FROM operations_feature_flags WHERE environment='STAGING'
    AND scope_type='APPLICATION' AND scope_reference IN (${references.map(() => "?").join(",")}) AND enabled='YES'`, [...references]);
  if (flags.length !== 0) throw new Error("STAGING_UNIFIED_CUSTOMER_FLAG_PREMATURELY_ENABLED");
  const [relationships] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM family_relationship_events r
    JOIN applications a ON a.id=r.application_id WHERE a.reference_number='TSH-STG-DYN-FAMILY' AND r.event_type='ESTABLISHED'`);
  const [groups] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM travel_groups g JOIN applications a ON a.id=g.application_id
    WHERE a.reference_number IN (${references.map(() => "?").join(",")})`, [...references]);
  if (Number(relationships[0].count) !== 3 || Number(groups[0].count) !== references.length) throw new Error("STAGING_UNIFIED_PREPARATION_INCOMPLETE");
  console.log(`STAGING_UNIFIED_RELATIONSHIPS=${Number(relationships[0].count)}`);
  console.log(`STAGING_UNIFIED_TRAVEL_GROUPS=${Number(groups[0].count)}`);
  console.log("STAGING_UNIFIED_CUSTOMER_FLAGS=OFF");
} finally { await pool.end(); }
