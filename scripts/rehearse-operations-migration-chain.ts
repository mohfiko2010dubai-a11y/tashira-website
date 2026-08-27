import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { operationsMigrationArtifacts } from "../api/lib/operations/production-readiness-manifest.ts";
import { parseMysqlClientScript, validateRehearsalTarget } from "../api/lib/operations/mysql-rehearsal-runner.ts";

const rawUrl = process.env.OPS_REHEARSAL_DATABASE_URL;
if (!rawUrl) throw new Error("OPS_REHEARSAL_DATABASE_URL_REQUIRED");
if (process.env.OPS_REHEARSAL_RECREATE !== "YES") throw new Error("OPS_REHEARSAL_RECREATE_CONFIRMATION_REQUIRED");
const target = validateRehearsalTarget(rawUrl);
const parsed = new URL(rawUrl);
const root = resolve(import.meta.dirname, "..");
const connection = await mysql.createConnection({
  host: target.host,
  port: target.port,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  multipleStatements: false,
});

async function executeFile(fileName: string): Promise<void> {
  const source = readFileSync(resolve(root, fileName), "utf8");
  for (const statement of parseMysqlClientScript(source)) await connection.query(statement);
}

try {
  await connection.query(`DROP DATABASE IF EXISTS \`${target.database}\``);
  await connection.query(`CREATE DATABASE \`${target.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${target.database}\``);
  await executeFile("scripts/fixtures/operations-pre-os-schema.sql");
  await executeFile("scripts/fixtures/operations-pre-os-data.sql");
  await executeFile("migrations/004_application_timeline.sql");

  const artifacts = operationsMigrationArtifacts(readdirSync(resolve(root, "migrations")));
  for (const artifact of artifacts) await executeFile(`migrations/${artifact.forward}`);
  for (const artifact of [...artifacts].reverse()) await executeFile(`migrations/${artifact.rollback}`);
  for (const artifact of artifacts) await executeFile(`migrations/${artifact.forward}`);

  const [[identity]] = await connection.query<mysql.RowDataPacket[]>("SELECT VERSION() version,DATABASE() databaseName");
  const [[schema]] = await connection.query<mysql.RowDataPacket[]>(`SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()) tablesCount,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema=DATABASE()) triggersCount,
    (SELECT COUNT(*) FROM applications) applications,
    (SELECT COUNT(*) FROM applicants) applicants,
    (SELECT COUNT(*) FROM documents) documents,
    (SELECT COUNT(*) FROM payments) payments,
    (SELECT COUNT(*) FROM invoices) invoices`);
  process.stdout.write(`${JSON.stringify({ result: "PASS", target: { ...target, remote: false }, mysqlVersion: identity.version,
    migrationRange: "014-041", migrationPairs: artifacts.length, rollbackReapply: "PASS", schema }, null, 2)}\n`);
} finally {
  await connection.end();
}
