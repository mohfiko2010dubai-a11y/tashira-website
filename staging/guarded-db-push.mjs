import fs from "node:fs";
import { spawnSync } from "node:child_process";

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
process.exit(result.status ?? 1);
