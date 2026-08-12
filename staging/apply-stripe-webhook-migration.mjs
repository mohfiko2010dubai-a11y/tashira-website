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
    throw new Error("Stripe webhook migration refused: staging database identity mismatch");
  }

  const migration = await readFile(
    new URL("../migrations/007_stripe_webhook_idempotency.sql", import.meta.url),
    "utf8",
  );
  await connection.query(migration);

  const [tableRows] = await connection.query(
    "SELECT COUNT(*) AS table_count FROM information_schema.tables "
      + "WHERE table_schema = DATABASE() AND table_name = 'stripe_webhook_events'",
  );
  const [indexRows] = await connection.query(
    "SELECT COUNT(DISTINCT index_name) AS index_count FROM information_schema.statistics "
      + "WHERE table_schema = DATABASE() AND table_name = 'stripe_webhook_events' "
      + "AND index_name = 'stripe_webhook_payment_intent_idx'",
  );
  console.log(JSON.stringify({
    database_name: identity.database_name,
    database_user: identity.database_user,
    table_count: Number(tableRows[0]?.table_count ?? 0),
    index_count: Number(indexRows[0]?.index_count ?? 0),
  }));
} finally {
  await connection.end();
}
