import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
});

try {
  const [identityRows] = await connection.query(
    "SELECT DATABASE() AS database_name, SUBSTRING_INDEX(CURRENT_USER(), '@', 1) AS database_user",
  );
  const identity = identityRows[0];
  if (
    identity?.database_name !== "tashira_staging"
    || identity?.database_user !== "tashira_staging_app"
  ) {
    throw new Error("Applicant-slot migration refused: staging database identity mismatch");
  }

  const migration = await readFile(
    new URL("../migrations/006_applicant_slot_uniqueness.sql", import.meta.url),
    "utf8",
  );
  await connection.query(migration);

  const [indexRows] = await connection.query(
    "SELECT COUNT(DISTINCT index_name) AS index_count FROM information_schema.statistics "
      + "WHERE table_schema = DATABASE() AND table_name = 'applicants' "
      + "AND index_name = 'applicant_application_index_uq'",
  );
  console.log(JSON.stringify({
    database_name: identity.database_name,
    database_user: identity.database_user,
    index_count: Number(indexRows[0]?.index_count ?? 0),
  }));
} finally {
  await connection.end();
}
