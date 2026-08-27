import { createHash } from "node:crypto";

export const OPERATIONS_MIGRATION_FIRST = 14;
export const OPERATIONS_MIGRATION_LAST = 42;

export type MigrationArtifact = {
  number: number;
  forward: string;
  rollback: string;
};

export function operationsMigrationArtifacts(fileNames: readonly string[]): readonly MigrationArtifact[] {
  const artifacts = new Map<number, { forward?: string; rollback?: string }>();
  for (const fileName of fileNames) {
    const match = /^(\d{3})_[a-z0-9_]+(\.rollback)?\.sql$/.exec(fileName);
    if (!match) continue;
    const number = Number(match[1]);
    if (number < OPERATIONS_MIGRATION_FIRST || number > OPERATIONS_MIGRATION_LAST) continue;
    const artifact = artifacts.get(number) ?? {};
    const kind = match[2] ? "rollback" : "forward";
    if (artifact[kind]) throw new Error(`OPERATIONS_MIGRATION_DUPLICATE:${number}:${kind}`);
    artifact[kind] = fileName;
    artifacts.set(number, artifact);
  }

  const result: MigrationArtifact[] = [];
  for (let number = OPERATIONS_MIGRATION_FIRST; number <= OPERATIONS_MIGRATION_LAST; number += 1) {
    const artifact = artifacts.get(number);
    if (!artifact?.forward || !artifact.rollback) throw new Error(`OPERATIONS_MIGRATION_PAIR_MISSING:${number}`);
    const forwardStem = artifact.forward.replace(/\.sql$/, "");
    if (artifact.rollback !== `${forwardStem}.rollback.sql`) throw new Error(`OPERATIONS_MIGRATION_PAIR_MISMATCH:${number}`);
    result.push({ number, forward: artifact.forward, rollback: artifact.rollback });
  }
  return result;
}

export function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
