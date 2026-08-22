import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

if (process.env.STAGING_MIGRATION_SOCKET !== "true") {
  throw new Error("Refund-email migration requires the explicit staging migration socket gate");
}

const connection = await mysql.createConnection({
  socketPath: "/var/run/mysqld/mysqld.sock",
  user: "root",
  database: "tashira_staging",
  multipleStatements: false,
});

try {
  const [identityRows] = await connection.query(
    "SELECT DATABASE() AS database_name, SUBSTRING_INDEX(CURRENT_USER(), '@', 1) AS database_user",
  );
  const identity = identityRows[0];
  if (identity?.database_name !== "tashira_staging" || identity?.database_user !== "root") {
    throw new Error("Refund-email migration refused: staging database identity mismatch");
  }

  const [templateRows] = await connection.query(
    "SELECT COLUMN_TYPE AS column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND column_name = 'email_template'",
  );
  const [sourceRows] = await connection.query(
    "SELECT COUNT(*) AS column_count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND column_name = 'source_reference'",
  );
  const [indexRows] = await connection.query(
    "SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS indexed_columns FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND index_name IN ('outbound_email_template_source_uq','outbound_email_template_sent_source_uq') GROUP BY index_name",
  );
  const templateReady = String(templateRows[0]?.column_type || "").includes("'REFUND_COMPLETED'");
  const sourceReady = Number(sourceRows[0]?.column_count || 0) === 1;
  const legacyIndexReady = indexRows.some((row) => row.index_name === "outbound_email_template_source_uq" && row.indexed_columns === "email_template,source_reference");
  const sentIndexReady = indexRows.some((row) => row.index_name === "outbound_email_template_sent_source_uq" && row.indexed_columns === "email_template,sent_source_reference");
  const [sentSourceRows] = await connection.query(
    "SELECT COUNT(*) AS column_count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND column_name = 'sent_source_reference'",
  );
  const sentSourceReady = Number(sentSourceRows[0]?.column_count || 0) === 1;
  if (legacyIndexReady && sentIndexReady) {
    throw new Error("Refund-email migration refused: conflicting idempotency indexes");
  }
  if ([templateReady, sourceReady, legacyIndexReady, sentSourceReady, sentIndexReady].some(Boolean) && !(templateReady && sourceReady && (legacyIndexReady || (sentSourceReady && sentIndexReady)))) {
    throw new Error("Refund-email migration refused: partial schema state requires review");
  }

  if (!templateReady) {
    const migration = await readFile(new URL("../migrations/012_refund_email_evidence.sql", import.meta.url), "utf8");
    await connection.query(migration);
  }
  if (!sentSourceReady) {
    const migration = await readFile(new URL("../migrations/013_refund_email_append_only_idempotency.sql", import.meta.url), "utf8");
    await connection.query(migration);
  }

  const [verifiedTemplateRows] = await connection.query(
    "SELECT COLUMN_TYPE AS column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND column_name = 'email_template'",
  );
  const [verifiedSourceRows] = await connection.query(
    "SELECT COUNT(*) AS column_count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND column_name = 'source_reference'",
  );
  const [verifiedSentSourceRows] = await connection.query(
    "SELECT COUNT(*) AS column_count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND column_name = 'sent_source_reference'",
  );
  const [verifiedIndexRows] = await connection.query(
    "SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index) AS indexed_columns FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'outbound_email_events' AND index_name = 'outbound_email_template_sent_source_uq' GROUP BY index_name",
  );
  if (
    !String(verifiedTemplateRows[0]?.column_type || "").includes("'REFUND_COMPLETED'")
    || Number(verifiedSourceRows[0]?.column_count || 0) !== 1
    || Number(verifiedSentSourceRows[0]?.column_count || 0) !== 1
    || verifiedIndexRows[0]?.indexed_columns !== "email_template,sent_source_reference"
  ) {
    throw new Error("Refund-email migration verification failed");
  }
  console.log(JSON.stringify({
    database_name: identity.database_name,
    database_user: identity.database_user,
    refund_template: "PRESENT",
    source_reference: "PRESENT",
    append_only_sent_evidence_index: "PRESENT",
  }));
} finally {
  await connection.end();
}
