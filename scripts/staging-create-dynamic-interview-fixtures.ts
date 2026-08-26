import { createPool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { env } from "../api/lib/env";

const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_FIXTURE_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_FIXTURE_PATH_IDENTITY_FAILED");

type ApplicantSeed = { name: string; nationality: string };
type ApplicationSeed = { reference: string; routeCode: string; baseType: "single" | "family"; applicants: readonly ApplicantSeed[] };
const fixtures: readonly ApplicationSeed[] = [
  { reference: "TSH-STG-DYN-INDIVIDUAL", routeCode: "STAGING_TEST_DYNAMIC", baseType: "single", applicants: [{ name: "Synthetic Individual", nationality: "EG" }] },
  { reference: "TSH-STG-DYN-GCC-FUTURE", routeCode: "STAGING_TEST_DYNAMIC", baseType: "single", applicants: [{ name: "Synthetic GCC Traveller", nationality: "EG" }] },
  { reference: "TSH-STG-DYN-FAMILY", routeCode: "STAGING_TEST_DYNAMIC", baseType: "family", applicants: [
    { name: "Synthetic Father", nationality: "EG" }, { name: "Synthetic Mother", nationality: "PK" },
    { name: "Synthetic Child One", nationality: "EG" }, { name: "Synthetic Child Two", nationality: "EG" },
  ] },
  { reference: "TSH-STG-DYN-NOT-RESEARCHED", routeCode: "STAGING_TEST_NOT_RESEARCHED", baseType: "single", applicants: [{ name: "Synthetic Unresearched", nationality: "ZZ" }] },
  { reference: "TSH-STG-DYN-CONFLICT", routeCode: "STAGING_TEST_CONFLICT", baseType: "single", applicants: [{ name: "Synthetic Conflict", nationality: "EG" }] },
];

async function rows(connection: PoolConnection, sql: string, values: readonly unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await connection.execute<RowDataPacket[]>(sql, [...values]); return result;
}

const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  for (const fixture of fixtures) {
    const existing = await rows(connection, "SELECT id,data_classification AS classification,visa_type AS routeCode FROM applications WHERE reference_number=? FOR UPDATE", [fixture.reference]);
    let applicationId: number;
    if (existing[0]) {
      if (String(existing[0].classification) !== "TEST" || String(existing[0].routeCode) !== fixture.routeCode) throw new Error("STAGING_FIXTURE_REFERENCE_COLLISION");
      applicationId = Number(existing[0].id);
    } else {
      const [result] = await connection.execute(`INSERT INTO applications
        (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,arrival_date,exchange_rate,total_amount_aed,total_amount_usd,status,payment_status,data_classification)
        VALUES (?,?, 'non-gcc',?,'regular',?,'+971000000000',NULL,1,0,0,'submitted','pending','TEST')`,
      [fixture.reference, fixture.baseType, fixture.routeCode, `${fixture.reference.toLowerCase()}@example.invalid`]);
      applicationId = Number(Reflect.get(result, "insertId"));
    }
    const existingApplicants = await rows(connection, "SELECT applicant_index AS applicantIndex,full_name AS fullName,nationality FROM applicants WHERE application_id=? ORDER BY applicant_index", [applicationId]);
    if (existingApplicants.length === 0) {
      for (const [index, applicant] of fixture.applicants.entries()) await connection.execute(`INSERT INTO applicants
        (application_id,applicant_index,full_name,nationality,passport_number,passport_expiry,profession)
        VALUES (?,?,?,?,NULL,NULL,NULL)`, [applicationId, index, applicant.name, applicant.nationality]);
    } else if (existingApplicants.length !== fixture.applicants.length || existingApplicants.some((row, index) =>
      Number(row.applicantIndex) !== index || String(row.fullName) !== fixture.applicants[index].name || String(row.nationality) !== fixture.applicants[index].nationality)) {
      throw new Error("STAGING_FIXTURE_APPLICANT_COLLISION");
    }
    const enabledFlags = await rows(connection, `SELECT flag_key AS flagKey FROM operations_feature_flags
      WHERE environment='STAGING' AND scope_type='APPLICATION' AND scope_reference=? AND enabled='YES'`, [fixture.reference]);
    if (enabledFlags.length > 0) throw new Error("STAGING_FIXTURE_FLAG_PREMATURELY_ENABLED");
  }
  await connection.commit();
  console.log(`STAGING_TEST_APPLICATIONS_READY=${fixtures.length}`);
  console.log(`STAGING_TEST_APPLICANTS_READY=${fixtures.reduce((total, fixture) => total + fixture.applicants.length, 0)}`);
  console.log("STAGING_TEST_CUSTOMER_FLAGS=OFF");
} catch (error) {
  await connection.rollback(); throw error;
} finally {
  connection.release(); await pool.end();
}
