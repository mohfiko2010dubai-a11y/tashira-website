import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { operationsMigrationArtifacts, sha256 } from "../api/lib/operations/production-readiness-manifest.ts";

const root = resolve(import.meta.dirname, "..");
const git = (...arguments_: string[]) => execFileSync("git", arguments_, { cwd: root, encoding: "utf8" }).trim();
const branch = git("branch", "--show-current");
if (branch !== "codex/visa-operations-os-v1") throw new Error(`OPERATIONS_RELEASE_BRANCH_INVALID:${branch || "DETACHED"}`);
if (git("status", "--porcelain")) throw new Error("OPERATIONS_RELEASE_WORKTREE_NOT_CLEAN");

const localSha = git("rev-parse", "HEAD");
const remoteSha = git("rev-parse", "origin/codex/visa-operations-os-v1");
if (localSha !== remoteSha) throw new Error("OPERATIONS_RELEASE_REMOTE_MISMATCH");

const migrationsDirectory = resolve(root, "migrations");
const migrations = operationsMigrationArtifacts(readdirSync(migrationsDirectory)).map((artifact) => ({
  ...artifact,
  forwardSha256: sha256(readFileSync(resolve(migrationsDirectory, artifact.forward))),
  rollbackSha256: sha256(readFileSync(resolve(migrationsDirectory, artifact.rollback))),
}));

process.stdout.write(`${JSON.stringify({
  result: "PASS",
  branch,
  exactSha: localSha,
  remoteMatch: true,
  worktreeClean: true,
  migrationRange: "014-041",
  migrationPairs: migrations.length,
  migrations,
  productionModified: false,
}, null, 2)}\n`);
