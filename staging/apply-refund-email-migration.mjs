import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  multipleStatements: false,
});

try {
  const [identityRows] = await connection.query(
    "SELECT DATABASE() AS database_name, SUBSTRING_INDEX(CURRENT_USER(), '@', 1) AS database_user",
  );
  const identity = identityRows[0];
  if (identity?.database_name !== "tashira_staging" || identity?.database_user !== "tashira_staging_app") {
    throw new Error("Refund-email migration refused: staging database identity mismatch");
  }

  const [templateRows] = await connection.query(
    "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND column_name = 'email_template'",
  );
  const [sourceRows] = await connection.query(
    "SELECT COUNT(*) AS column_count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND column_name = 'source_reference'",
  );
  const [indexRows] = await connection.query(
    "SELECT COUNT(DISTINCT index_name) AS index_count FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND index_name = 'outbound_email_template_source_uq'",
  );
  const templateReady = String(templateRows[0]?.column_type || "").includes("'REFUND_COMPLETED'");
  const sourceReady = Number(sourceRows[0]?.column_count || 0) === 1;
  const indexReady = Number(indexRows[0]?.index_count || 0) === 1;
  if ([templateReady, sourceReady, indexReady].some(Boolean) && ![templateReady, sourceReady, indexReady].every(Boolean)) {
    throw new Error("Refund-email migration refused: partial schema state requires review");
  }

  if (!templateReady) {
    const migration = await readFile(new URL("../migrations/012_refund_email_evidence.sql", import.meta.url), "utf8");
    await connection.query(migration);
  }

  const [verifiedTemplateRows] = await connection.query(
    "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND column_name = 'email_template'",
  );
  const [verifiedSourceRows] = await connection.query(
    "SELECT COUNT(*) AS column_count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND column_name = 'source_reference'",
  );
  const [verifiedIndexRows] = await connection.query(
    "SELECT COUNT(DISTINCT index_name) AS index_count FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND index_name = 'outbound_email_template_source_uq'",
  );
  if (
    !String(verifiedTemplateRows[0]?.column_type || "").includes("'REFUND_COMPLETED'")
    || Number(verifiedSourceRows[0]?.column_count || 0) !== 1
    || Number(verifiedIndexRows[0]?.index_count || 0) !== 1
  ) {
    throw new Error("Refund-email migration verification failed");
  }
  console.log(JSON.stringify({
    database_name: identity.database_name,
    database_user: identity.database_user,
    refund_template: "PRESENT",
    source_reference: "PRESENT",
    unique_evidence_index: "PRESENT",
  }));
} finally {
  await connection.end();
}
