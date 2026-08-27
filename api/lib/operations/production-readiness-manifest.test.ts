import { describe, expect, it } from "vitest";
import { operationsMigrationArtifacts, sha256 } from "./production-readiness-manifest";

const chain = Array.from({ length: 29 }, (_, index) => {
  const number = String(index + 14).padStart(3, "0");
  return [`${number}_migration.sql`, `${number}_migration.rollback.sql`];
}).flat();

describe("Operations Production readiness manifest", () => {
  it("requires the complete ordered forward and rollback chain", () => {
    const artifacts = operationsMigrationArtifacts(chain);
    expect(artifacts).toHaveLength(29);
    expect(artifacts[0]).toEqual({ number: 14, forward: "014_migration.sql", rollback: "014_migration.rollback.sql" });
    expect(artifacts.at(-1)?.number).toBe(42);
  });

  it("fails closed on a missing rollback", () => {
    expect(() => operationsMigrationArtifacts(chain.filter((file) => file !== "027_migration.rollback.sql")))
      .toThrow("OPERATIONS_MIGRATION_PAIR_MISSING:27");
  });

  it("fails closed on duplicate migration identities", () => {
    expect(() => operationsMigrationArtifacts([...chain, "020_other.sql"]))
      .toThrow("OPERATIONS_MIGRATION_DUPLICATE:20:forward");
  });

  it("produces stable SHA-256 evidence", () => expect(sha256("synthetic")).toMatch(/^[a-f0-9]{64}$/));
});
