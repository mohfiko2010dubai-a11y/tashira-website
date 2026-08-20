import fs from "node:fs";
import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";

function readSecret(name) {
  const value = fs.readFileSync(`/run/secrets/${name}`, "utf8").trim();
  if (!value) throw new Error(`Staging secret ${name} is empty`);
  return value;
}

const databaseName = process.env.STAGING_DATABASE_NAME;
const databaseUser = process.env.STAGING_DATABASE_USER;

if (process.env.STAGING_RUNTIME !== "true") {
  throw new Error("Refusing database push outside an explicit staging runtime");
}
if (databaseName !== "tashira_staging" || databaseUser !== "tashira_staging_app") {
  throw new Error("Refusing database push for a non-staging database identity");
}

const password = encodeURIComponent(readSecret("mysql_app_password"));
process.env.DATABASE_URL = `mysql://${databaseUser}:${password}@staging-db:3306/${databaseName}`;

const result = spawnSync(
  process.execPath,
  ["node_modules/drizzle-kit/bin.cjs", "push", "--force"],
  { stdio: "inherit", env: process.env },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const connection = await mysql.createConnection({
  host: "staging-db",
  port: 3306,
  user: databaseUser,
  password: readSecret("mysql_app_password"),
  database: databaseName,
  multipleStatements: false,
});

try {
  const [[identity]] = await connection.query("SELECT DATABASE() AS database_name");
  if (identity.database_name !== "tashira_staging") {
    throw new Error("Migration connection did not resolve to tashira_staging");
  }

  const source = fs.readFileSync("migrations/005_business_architecture.sql", "utf8");
  const [ordinarySource, triggerSource = ""] = source.split("DELIMITER $$");
  const ordinaryStatements = ordinarySource
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  const triggerStatements = triggerSource
    .replace(/DELIMITER\s*;\s*$/m, "")
    .split("$$")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of [...ordinaryStatements, ...triggerStatements]) {
    await connection.query(statement);
  }

  const [tables] = await connection.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name IN ('pricing_rules','business_settings_versions','application_price_snapshots','retention_records')",
    [databaseName],
  );
  const [triggers] = await connection.query(
    "SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = ? AND trigger_name IN ('application_timeline_no_update','price_snapshot_no_update','legal_hold_events_no_delete')",
    [databaseName],
  );
  if (tables.length !== 4 || triggers.length !== 3) {
    throw new Error("Migration 005 verification did not find all required staging objects");
  }
  console.info("Staging schema initialization and migration 005 verification completed");
} finally {
  await connection.end();
}
