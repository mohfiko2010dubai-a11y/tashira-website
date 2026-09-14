import { getDb } from "../api/queries/connection";
import { realpathSync } from "node:fs";
import { assertSyntheticSeedTarget } from "../api/lib/synthetic-seed-guard";
// TODO: import tables from "./schema"

async function seed() {
  assertSyntheticSeedTarget({ directory: realpathSync(process.cwd()), databaseUrl: process.env.DATABASE_URL || '',
    storageRoot: realpathSync(process.env.STORAGE_ROOT || '.') });
  const db = getDb();
  void db;
  console.log("Seeding database...");

  // TODO: insert seed data, e.g.
  // await db.insert(schema.posts).values([
  //   { title: "First post", content: "Hello world" },
  // ]);

  console.log("Done.");
  process.exit(0); // close MySQL connection pool
}

seed();
